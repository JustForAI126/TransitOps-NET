using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TransitOps.Application.DTOs;
using TransitOps.Application.Services;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Infrastructure.Services;

public sealed class SaasOnboardingService : ISaasOnboardingService
{
    private static readonly TimeSpan VerificationCodeLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan SetupLinkLifetime = TimeSpan.FromHours(48);
    private readonly TransitOpsDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SaasOnboardingOptions _onboardingOptions;
    private readonly RazorpayOptions _razorpayOptions;
    private readonly SmtpEmailOptions _emailOptions;
    private readonly PublicApplicationOptions _applicationOptions;
    private readonly ILogger<SaasOnboardingService> _logger;
    private readonly string _verificationHashKey;

    public SaasOnboardingService(
        TransitOpsDbContext db,
        UserManager<ApplicationUser> userManager,
        IHttpClientFactory httpClientFactory,
        IOptions<SaasOnboardingOptions> onboardingOptions,
        IOptions<RazorpayOptions> razorpayOptions,
        IOptions<SmtpEmailOptions> emailOptions,
        IOptions<PublicApplicationOptions> applicationOptions,
        IConfiguration configuration,
        ILogger<SaasOnboardingService> logger)
    {
        _db = db;
        _userManager = userManager;
        _httpClientFactory = httpClientFactory;
        _onboardingOptions = onboardingOptions.Value;
        _razorpayOptions = razorpayOptions.Value;
        _emailOptions = emailOptions.Value;
        _applicationOptions = applicationOptions.Value;
        _logger = logger;
        _verificationHashKey = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Configure Jwt:Key before enabling onboarding.");
    }

    public IReadOnlyList<SubscriptionPlanResponse> GetPlans() =>
        _onboardingOptions.Plans
            .Select(plan => new SubscriptionPlanResponse(
                plan.Id,
                plan.Name,
                plan.AmountPaise,
                plan.Currency,
                plan.TermMonths,
                plan.Features))
            .ToArray();

    public async Task<PurchaseSessionResponse> BeginAsync(
        BeginOnboardingRequest request,
        CancellationToken cancellationToken)
    {
        EnsureEmailConfigured();

        var email = request.Email.Trim();
        var normalizedEmail = email.ToUpperInvariant();
        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            throw new OnboardingException(
                StatusCodes.Status409Conflict,
                "This email already has an account. Sign in or contact your organization administrator.");
        }

        var purchaseSecret = CreateSecureToken();
        var verificationCode = RandomNumberGenerator.GetInt32(0, 1_000_000)
            .ToString("D6", CultureInfo.InvariantCulture);
        var purchase = new SaasPurchase
        {
            OrganizationName = request.OrganizationName.Trim(),
            FullName = request.FullName.Trim(),
            Email = email,
            NormalizedEmail = normalizedEmail,
            CapabilityTokenHash = HashToken(purchaseSecret),
            EmailVerificationCodeHash = HashVerificationCode(purchaseSecret, verificationCode),
            EmailVerificationExpiresAtUtc = DateTimeOffset.UtcNow.Add(VerificationCodeLifetime),
            PaymentStatus = "AwaitingEmailVerification"
        };
        _db.SaasPurchases.Add(purchase);
        await _db.SaveChangesAsync(cancellationToken);

        var message = $"""
            Your TransitOps email verification code is {verificationCode}.

            This code expires in 10 minutes. If you did not request this, you can ignore this email.
            """;
        var emailSent = await TrySendEmailAsync(
            email,
            "Verify your TransitOps organization email",
            message,
            cancellationToken);

        return new PurchaseSessionResponse(
            purchase.Id,
            purchaseSecret,
            emailSent,
            emailSent
                ? "Verification code sent. It expires in 10 minutes."
                : "Your purchase session is saved, but the verification email could not be delivered. Check SMTP configuration and retry the code.");
    }

    public async Task<EmailVerificationResponse> VerifyEmailAsync(
        VerifyOnboardingEmailRequest request,
        CancellationToken cancellationToken)
    {
        var purchase = await GetAuthorizedPurchaseAsync(
            request.PurchaseId,
            request.PurchaseSecret,
            cancellationToken);

        if (purchase.EmailVerifiedAtUtc is not null)
            return new EmailVerificationResponse(true, "Email address verified.");

        if (purchase.EmailVerificationExpiresAtUtc is null ||
            purchase.EmailVerificationExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            throw new OnboardingException(
                StatusCodes.Status410Gone,
                "The verification code expired. Start email verification again.");
        }

        if (purchase.EmailVerificationAttempts >= 5)
        {
            throw new OnboardingException(
                StatusCodes.Status429TooManyRequests,
                "Too many incorrect verification codes. Start email verification again.");
        }

        purchase.EmailVerificationAttempts++;
        var expectedHash = HashVerificationCode(request.PurchaseSecret, request.Code);
        if (!FixedTimeEquals(purchase.EmailVerificationCodeHash, expectedHash))
        {
            await _db.SaveChangesAsync(cancellationToken);
            throw new OnboardingException(StatusCodes.Status400BadRequest, "The verification code is incorrect.");
        }

        purchase.EmailVerifiedAtUtc = DateTimeOffset.UtcNow;
        purchase.EmailVerificationCodeHash = null;
        purchase.EmailVerificationExpiresAtUtc = null;
        await _db.SaveChangesAsync(cancellationToken);
        return new EmailVerificationResponse(true, "Email address verified.");
    }

    public async Task<VerificationDeliveryResponse> ResendVerificationAsync(
        ResendOnboardingVerificationRequest request,
        CancellationToken cancellationToken)
    {
        EnsureEmailConfigured();
        var purchase = await GetAuthorizedPurchaseAsync(
            request.PurchaseId,
            request.PurchaseSecret,
            cancellationToken);
        if (purchase.EmailVerifiedAtUtc is not null)
            throw new OnboardingException(StatusCodes.Status409Conflict, "This email address is already verified.");
        if (purchase.EmailVerificationResends >= 3)
            throw new OnboardingException(
                StatusCodes.Status429TooManyRequests,
                "The verification code resend limit was reached. Start a new onboarding request later.");

        var verificationCode = RandomNumberGenerator.GetInt32(0, 1_000_000)
            .ToString("D6", CultureInfo.InvariantCulture);
        purchase.EmailVerificationCodeHash = HashVerificationCode(request.PurchaseSecret, verificationCode);
        purchase.EmailVerificationExpiresAtUtc = DateTimeOffset.UtcNow.Add(VerificationCodeLifetime);
        purchase.EmailVerificationAttempts = 0;
        purchase.EmailVerificationResends++;
        await _db.SaveChangesAsync(cancellationToken);

        var message = $"""
            Your new TransitOps email verification code is {verificationCode}.

            This code expires in 10 minutes. If you did not request this, you can ignore this email.
            """;
        var sent = await TrySendEmailAsync(
            purchase.Email,
            "Verify your TransitOps organization email",
            message,
            cancellationToken);
        return new VerificationDeliveryResponse(
            sent,
            sent
                ? "A replacement verification code was sent."
                : "The new verification code could not be delivered. Check SMTP configuration and retry.");
    }

    public async Task<CreatePaymentOrderResponse> CreatePaymentOrderAsync(
        CreatePaymentOrderRequest request,
        CancellationToken cancellationToken)
    {
        EnsureRazorpayConfigured(requireWebhookSecret: false);
        var purchase = await GetAuthorizedPurchaseAsync(
            request.PurchaseId,
            request.PurchaseSecret,
            cancellationToken);

        if (purchase.EmailVerifiedAtUtc is null)
            throw new OnboardingException(StatusCodes.Status403Forbidden, "Verify the organization email before checkout.");
        if (purchase.PaymentStatus == "Paid")
            throw new OnboardingException(StatusCodes.Status409Conflict, "This purchase has already been paid.");
        if (await _db.Organizations.AnyAsync(
                organization => organization.NormalizedBillingEmail == purchase.NormalizedEmail,
                cancellationToken))
        {
            throw new OnboardingException(
                StatusCodes.Status409Conflict,
                "An organization is already registered with this email. Sign in to manage its subscription.");
        }
        if (await _userManager.FindByEmailAsync(purchase.Email) is not null)
            throw new OnboardingException(
                StatusCodes.Status409Conflict,
                "An account already exists with this email. Sign in or contact your organization administrator.");

        var plan = FindPlan(request.PlanId);
        if (purchase.RazorpayOrderId is not null)
        {
            if (!string.Equals(purchase.PlanId, plan.Id, StringComparison.Ordinal))
                throw new OnboardingException(
                    StatusCodes.Status409Conflict,
                    "A payment order already exists for a different plan. Start a new purchase to change plans.");
            return ToOrderResponse(purchase, plan);
        }

        var order = await CreateRazorpayOrderAsync(purchase, plan, cancellationToken);
        purchase.PlanId = plan.Id;
        purchase.PlanName = plan.Name;
        purchase.AmountPaise = plan.AmountPaise;
        purchase.TermMonths = plan.TermMonths;
        purchase.RazorpayOrderId = order.Id;
        purchase.PaymentStatus = "AwaitingPayment";
        await _db.SaveChangesAsync(cancellationToken);
        return ToOrderResponse(purchase, plan);
    }

    public async Task<PaymentVerificationResponse> VerifyPaymentAsync(
        VerifyPaymentRequest request,
        CancellationToken cancellationToken)
    {
        EnsureRazorpayConfigured(requireWebhookSecret: false);
        var purchase = await _db.SaasPurchases
            .SingleOrDefaultAsync(
                candidate => candidate.RazorpayOrderId == request.RazorpayOrderId,
                cancellationToken)
            ?? throw new OnboardingException(StatusCodes.Status404NotFound, "The payment order was not found.");

        var expectedSignature = PaymentSignatureVerifier.ComputeCheckoutSignature(
            _razorpayOptions.KeySecret,
            request.RazorpayOrderId,
            request.RazorpayPaymentId);
        if (!PaymentSignatureVerifier.VerifyHex(expectedSignature, request.RazorpaySignature))
            throw new OnboardingException(StatusCodes.Status400BadRequest, "Razorpay payment signature is invalid.");

        await VerifyCapturedPaymentAsync(
            request.RazorpayOrderId,
            request.RazorpayPaymentId,
            purchase.AmountPaise!.Value,
            "INR",
            cancellationToken);

        await RecordVerifiedPaymentAsync(purchase.Id, request.RazorpayPaymentId, cancellationToken);
        return await SendPendingEmailsAsync(purchase.Id, cancellationToken);
    }

    public async Task HandleWebhookAsync(
        string requestBody,
        string? signature,
        string? eventId,
        CancellationToken cancellationToken)
    {
        EnsureRazorpayConfigured(requireWebhookSecret: true);
        if (string.IsNullOrWhiteSpace(eventId) || eventId.Length > 128)
            throw new OnboardingException(StatusCodes.Status400BadRequest, "A valid Razorpay event identifier is required.");

        var expectedSignature = PaymentSignatureVerifier.ComputeWebhookSignature(
            _razorpayOptions.WebhookSecret,
            requestBody);
        if (!PaymentSignatureVerifier.VerifyHex(expectedSignature, signature))
            throw new OnboardingException(StatusCodes.Status400BadRequest, "Razorpay webhook signature is invalid.");

        if (await _db.RazorpayWebhookReceipts.AnyAsync(
                receipt => receipt.EventId == eventId,
                cancellationToken))
            return;

        using var document = JsonDocument.Parse(requestBody);
        var root = document.RootElement;
        var eventName = root.GetProperty("event").GetString();
        if (eventName is not ("payment.captured" or "payment.failed"))
        {
            await RecordWebhookReceiptAsync(eventId, cancellationToken);
            return;
        }

        var entity = root.GetProperty("payload").GetProperty("payment").GetProperty("entity");
        var orderId = entity.GetProperty("order_id").GetString();
        var paymentId = entity.GetProperty("id").GetString();
        if (string.IsNullOrWhiteSpace(orderId) || string.IsNullOrWhiteSpace(paymentId))
            throw new OnboardingException(StatusCodes.Status400BadRequest, "Razorpay webhook has incomplete payment details.");

        if (eventName == "payment.captured")
        {
            var purchase = await _db.SaasPurchases
                .SingleOrDefaultAsync(candidate => candidate.RazorpayOrderId == orderId, cancellationToken)
                ?? throw new OnboardingException(StatusCodes.Status404NotFound, "The webhook payment order was not found.");
            await VerifyCapturedPaymentAsync(
                orderId,
                paymentId,
                purchase.AmountPaise!.Value,
                "INR",
                cancellationToken);
            await RecordVerifiedPaymentAsync(purchase.Id, paymentId, cancellationToken);
            await SendPendingEmailsAsync(purchase.Id, cancellationToken);
        }
        else if (eventName == "payment.failed")
        {
            var purchase = await _db.SaasPurchases
                .SingleOrDefaultAsync(candidate => candidate.RazorpayOrderId == orderId, cancellationToken);
            if (purchase is not null)
            {
                await _db.SaasPurchases
                    .Where(candidate => candidate.Id == purchase.Id && candidate.PaymentStatus != "Paid")
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(candidate => candidate.PaymentStatus, "PaymentFailed"),
                        cancellationToken);
            }
        }

        await RecordWebhookReceiptAsync(eventId, cancellationToken);
    }

    private async Task RecordWebhookReceiptAsync(string eventId, CancellationToken cancellationToken)
    {
        _db.RazorpayWebhookReceipts.Add(new RazorpayWebhookReceipt { EventId = eventId });
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            var duplicateWasRecorded = await _db.RazorpayWebhookReceipts
                .AsNoTracking()
                .AnyAsync(receipt => receipt.EventId == eventId, cancellationToken);
            if (!duplicateWasRecorded)
                throw;
            var localReceipt = _db.RazorpayWebhookReceipts.Local
                .FirstOrDefault(receipt => receipt.EventId == eventId);
            if (localReceipt is not null)
                _db.Entry(localReceipt).State = EntityState.Detached;
        }
    }

    public async Task<PaymentVerificationResponse> RetryEmailsAsync(
        RetryOnboardingEmailsRequest request,
        CancellationToken cancellationToken)
    {
        var purchase = await GetAuthorizedPurchaseAsync(
            request.PurchaseId,
            request.PurchaseSecret,
            cancellationToken);
        if (purchase.PaymentStatus != "Paid")
            throw new OnboardingException(
                StatusCodes.Status409Conflict,
                "Email delivery can only be retried after verified payment.");
        if (purchase.SetupCompletedAtUtc is null)
        {
            purchase.SetupEmailSentAtUtc = null;
            await _db.SaveChangesAsync(cancellationToken);
        }
        return await SendPendingEmailsAsync(purchase.Id, cancellationToken);
    }

    public async Task<PurchaseProgressResponse> GetProgressAsync(
        RetryOnboardingEmailsRequest request,
        CancellationToken cancellationToken)
    {
        var purchase = await GetAuthorizedPurchaseAsync(
            request.PurchaseId,
            request.PurchaseSecret,
            cancellationToken);
        return new PurchaseProgressResponse(
            purchase.EmailVerifiedAtUtc is not null,
            purchase.PaymentStatus == "Paid",
            purchase.ReceiptEmailSentAtUtc is not null,
            purchase.SetupEmailSentAtUtc is not null,
            purchase.SetupCompletedAtUtc is not null,
            purchase.RazorpayOrderId,
            purchase.PlanId,
            purchase.SetupTokenExpiresAtUtc,
            purchase.PaymentStatus);
    }

    public async Task<AccountSetupResponse> CompleteAccountSetupAsync(
        CompleteAccountSetupRequest request,
        CancellationToken cancellationToken)
    {
        var setupHash = HashToken(request.Token);
        var purchase = await _db.SaasPurchases
            .SingleOrDefaultAsync(candidate => candidate.SetupTokenHash == setupHash, cancellationToken)
            ?? throw new OnboardingException(StatusCodes.Status410Gone, "This account setup link is invalid or has already been used.");

        if (purchase.PaymentStatus != "Paid" ||
            purchase.SetupCompletedAtUtc is not null ||
            purchase.SetupTokenExpiresAtUtc is null ||
            purchase.SetupTokenExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            throw new OnboardingException(StatusCodes.Status410Gone, "This account setup link is invalid, expired, or already used.");
        }

        if (purchase.TenantId is null)
            throw new OnboardingException(StatusCodes.Status409Conflict, "Organization provisioning is incomplete. Contact support.");

        var organization = await _db.Organizations
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.TenantId == purchase.TenantId, cancellationToken)
            ?? throw new OnboardingException(StatusCodes.Status409Conflict, "Organization provisioning is incomplete. Contact support.");

        if (await _userManager.FindByEmailAsync(purchase.Email) is not null)
            throw new OnboardingException(StatusCodes.Status409Conflict, "An account already exists for this email. Sign in or contact support.");

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var user = new ApplicationUser
        {
            UserName = purchase.Email,
            Email = purchase.Email,
            FullName = purchase.FullName,
            Role = UserRole.OrganizationAdmin,
            TenantId = organization.TenantId,
            EmailConfirmed = true,
            LockoutEnabled = true,
            IsDemoAccount = false
        };
        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            throw new OnboardingException(
                StatusCodes.Status400BadRequest,
                "The password does not meet the account security requirements.");
        }

        purchase.SetupCompletedAtUtc = DateTimeOffset.UtcNow;
        purchase.SetupTokenHash = null;
        purchase.SetupTokenExpiresAtUtc = null;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new AccountSetupResponse(
            user.Id,
            user.FullName,
            user.Email!,
            "organization_admin",
            organization.TenantId);
    }

    private async Task<RazorpayOrder> CreateRazorpayOrderAsync(
        SaasPurchase purchase,
        SaasOnboardingOptions.Plan plan,
        CancellationToken cancellationToken)
    {
        var client = CreateRazorpayClient();
        var requestBody = JsonSerializer.Serialize(new
        {
            amount = plan.AmountPaise,
            currency = plan.Currency,
            receipt = purchase.Id.ToString("N"),
            notes = new Dictionary<string, string>
            {
                ["purchase_id"] = purchase.Id.ToString(),
                ["plan_id"] = plan.Id
            }
        });
        using var response = await client.PostAsync(
            "orders",
            new StringContent(requestBody, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Razorpay order creation returned HTTP {StatusCode}.", (int)response.StatusCode);
            throw new OnboardingException(
                StatusCodes.Status503ServiceUnavailable,
                "Razorpay could not create a payment order. Please retry later.");
        }

        var order = await response.Content.ReadFromJsonAsync<RazorpayOrder>(cancellationToken: cancellationToken);
        if (order is null || string.IsNullOrWhiteSpace(order.Id) ||
            order.Amount != plan.AmountPaise ||
            !string.Equals(order.Currency, plan.Currency, StringComparison.Ordinal))
        {
            _logger.LogError("Razorpay returned an invalid order response for purchase {PurchaseId}.", purchase.Id);
            throw new OnboardingException(
                StatusCodes.Status503ServiceUnavailable,
                "Razorpay returned an invalid payment order. Please contact support before retrying.");
        }

        return order;
    }

    private async Task VerifyCapturedPaymentAsync(
        string orderId,
        string paymentId,
        long expectedAmount,
        string expectedCurrency,
        CancellationToken cancellationToken)
    {
        var client = CreateRazorpayClient();
        using var response = await client.GetAsync(
            $"payments/{Uri.EscapeDataString(paymentId)}",
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Razorpay payment lookup returned HTTP {StatusCode}.", (int)response.StatusCode);
            throw new OnboardingException(
                StatusCodes.Status503ServiceUnavailable,
                "Payment status could not be confirmed with Razorpay. Retry verification.");
        }

        var payment = await response.Content.ReadFromJsonAsync<RazorpayPayment>(cancellationToken: cancellationToken);
        if (payment is null ||
            !string.Equals(payment.OrderId, orderId, StringComparison.Ordinal) ||
            !string.Equals(payment.Status, "captured", StringComparison.Ordinal) ||
            payment.Amount != expectedAmount ||
            !string.Equals(payment.Currency, expectedCurrency, StringComparison.Ordinal))
        {
            throw new OnboardingException(
                StatusCodes.Status409Conflict,
                "Razorpay has not confirmed a captured payment matching this order.");
        }
    }

    private async Task RecordVerifiedPaymentAsync(
        Guid purchaseId,
        string paymentId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var purchase = await _db.SaasPurchases
            .SingleAsync(candidate => candidate.Id == purchaseId, cancellationToken);
        if (purchase.PaymentStatus == "Paid")
        {
            if (!string.Equals(purchase.RazorpayPaymentId, paymentId, StringComparison.Ordinal))
                throw new OnboardingException(StatusCodes.Status409Conflict, "A different payment has already been recorded for this order.");
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        var emailNormalized = purchase.NormalizedEmail;
        var organization = await _db.Organizations
            .SingleOrDefaultAsync(candidate => candidate.NormalizedBillingEmail == emailNormalized, cancellationToken);
        var isNewOrganization = organization is null;
        organization ??= new Organization
        {
            TenantId = Guid.NewGuid().ToString("N"),
            Name = purchase.OrganizationName,
            BillingEmail = purchase.Email,
            NormalizedBillingEmail = emailNormalized
        };
        if (isNewOrganization)
            _db.Organizations.Add(organization);

        var existingSubscription = await _db.OrganizationSubscriptions
            .AnyAsync(subscription => subscription.RazorpayPaymentId == paymentId, cancellationToken);
        if (!existingSubscription)
        {
            var startsAt = DateTimeOffset.UtcNow;
            _db.OrganizationSubscriptions.Add(new OrganizationSubscription
            {
                TenantId = organization.TenantId,
                PlanId = purchase.PlanId!,
                PlanName = purchase.PlanName!,
                AmountPaise = purchase.AmountPaise!.Value,
                Currency = "INR",
                TermMonths = purchase.TermMonths!.Value,
                StartsAtUtc = startsAt,
                EndsAtUtc = startsAt.AddMonths(purchase.TermMonths.Value),
                Status = "Active",
                RazorpayOrderId = purchase.RazorpayOrderId!,
                RazorpayPaymentId = paymentId
            });
        }

        purchase.RazorpayPaymentId = paymentId;
        purchase.PaymentStatus = "Paid";
        purchase.TenantId = organization.TenantId;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task<PaymentVerificationResponse> SendPendingEmailsAsync(
        Guid purchaseId,
        CancellationToken cancellationToken)
    {
        var purchase = await _db.SaasPurchases
            .SingleAsync(candidate => candidate.Id == purchaseId, cancellationToken);
        if (purchase.PaymentStatus != "Paid")
            throw new OnboardingException(StatusCodes.Status409Conflict, "Payment has not been verified.");

        var emailConfigured = IsEmailConfigured();
        if (!emailConfigured)
        {
            _logger.LogError("Onboarding email delivery is pending because SMTP settings are incomplete.");
            return new PaymentVerificationResponse(
                true,
                purchase.ReceiptEmailSentAtUtc is not null,
                purchase.SetupEmailSentAtUtc is not null,
                purchase.SetupCompletedAtUtc is not null,
                "Payment verified and organization provisioned. Configure SMTP email delivery, then retry the emails.");
        }

        if (purchase.ReceiptEmailSentAtUtc is null)
        {
            var endsAt = await _db.OrganizationSubscriptions
                .Where(subscription => subscription.RazorpayPaymentId == purchase.RazorpayPaymentId)
                .Select(subscription => subscription.EndsAtUtc)
                .SingleAsync(cancellationToken);
            var receipt = $"""
                TransitOps purchase receipt
                Organization: {purchase.OrganizationName}
                Plan: {purchase.PlanName}
                Amount paid: {FormatRupees(purchase.AmountPaise!.Value)}
                Term: {purchase.TermMonths} month(s)
                Active until: {endsAt:yyyy-MM-dd}
                Payment reference: {purchase.RazorpayPaymentId}
                """;
            if (await TrySendEmailAsync(purchase.Email, "TransitOps subscription payment receipt", receipt, cancellationToken))
            {
                purchase.ReceiptEmailSentAtUtc = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(cancellationToken);
            }
        }

        if (purchase.SetupCompletedAtUtc is null && purchase.SetupEmailSentAtUtc is null)
        {
            var existingUser = await _userManager.FindByEmailAsync(purchase.Email);
            if (existingUser is not null && existingUser.TenantId == purchase.TenantId &&
                existingUser.Role == UserRole.OrganizationAdmin)
            {
                purchase.SetupCompletedAtUtc = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(cancellationToken);
            }
            else
            {
                var token = CreateSecureToken();
                purchase.SetupTokenHash = HashToken(token);
                purchase.SetupTokenExpiresAtUtc = DateTimeOffset.UtcNow.Add(SetupLinkLifetime);
                await _db.SaveChangesAsync(cancellationToken);
                var setupUrl = $"{_applicationOptions.BaseUrl.TrimEnd('/')}/setup-account?token={Uri.EscapeDataString(token)}";
                var setupMessage = $"""
                    Your TransitOps organization is ready.

                    Set up your Organization Admin account using this single-use link:
                    {setupUrl}

                    This link expires in 48 hours. TransitOps will never email you a password.
                    """;
                if (await TrySendEmailAsync(purchase.Email, "Set up your TransitOps administrator account", setupMessage, cancellationToken))
                {
                    purchase.SetupEmailSentAtUtc = DateTimeOffset.UtcNow;
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }
        }

        var receiptSent = purchase.ReceiptEmailSentAtUtc is not null;
        var setupCompleted = purchase.SetupCompletedAtUtc is not null;
        var setupSent = purchase.SetupEmailSentAtUtc is not null || setupCompleted;
        var message = receiptSent && setupSent
            ? "Payment verified. Check your email for the receipt and account setup link."
            : "Payment verified and organization provisioned, but an email could not be delivered. Retry email delivery.";
        return new PaymentVerificationResponse(true, receiptSent, setupSent, setupCompleted, message);
    }

    private async Task<SaasPurchase> GetAuthorizedPurchaseAsync(
        Guid purchaseId,
        string purchaseSecret,
        CancellationToken cancellationToken)
    {
        var purchase = await _db.SaasPurchases
            .SingleOrDefaultAsync(candidate => candidate.Id == purchaseId, cancellationToken)
            ?? throw new OnboardingException(StatusCodes.Status404NotFound, "The purchase session was not found.");
        if (!FixedTimeEquals(purchase.CapabilityTokenHash, HashToken(purchaseSecret)))
            throw new OnboardingException(StatusCodes.Status403Forbidden, "The purchase session is invalid.");
        return purchase;
    }

    private SaasOnboardingOptions.Plan FindPlan(string planId)
    {
        var plan = _onboardingOptions.Plans.SingleOrDefault(candidate =>
            string.Equals(candidate.Id, planId, StringComparison.Ordinal));
        if (plan is null || plan.AmountPaise <= 0 || plan.TermMonths <= 0 ||
            !string.Equals(plan.Currency, "INR", StringComparison.Ordinal))
        {
            throw new OnboardingException(
                StatusCodes.Status503ServiceUnavailable,
                "The selected subscription plan is not configured for checkout.");
        }

        return plan;
    }

    private CreatePaymentOrderResponse ToOrderResponse(
        SaasPurchase purchase,
        SaasOnboardingOptions.Plan plan) =>
        new(
            purchase.RazorpayOrderId!,
            _razorpayOptions.KeyId,
            purchase.AmountPaise!.Value,
            plan.Currency,
            plan.Id,
            plan.Name,
            plan.TermMonths);

    private HttpClient CreateRazorpayClient()
    {
        var client = _httpClientFactory.CreateClient("Razorpay");
        var credentials = Convert.ToBase64String(
            Encoding.ASCII.GetBytes($"{_razorpayOptions.KeyId}:{_razorpayOptions.KeySecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        return client;
    }

    private async Task<bool> TrySendEmailAsync(
        string recipient,
        string subject,
        string body,
        CancellationToken cancellationToken)
    {
        if (!IsEmailConfigured())
            return false;
        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_emailOptions.FromAddress, _emailOptions.FromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = false
            };
            message.To.Add(new MailAddress(recipient));
            using var smtp = new SmtpClient(_emailOptions.Host, _emailOptions.Port)
            {
                EnableSsl = _emailOptions.EnableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_emailOptions.UserName, _emailOptions.Password)
            };
            await smtp.SendMailAsync(message, cancellationToken);
            return true;
        }
        catch (SmtpException exception)
        {
            _logger.LogError(exception, "Could not deliver an onboarding email.");
            return false;
        }
        catch (FormatException exception)
        {
            _logger.LogError(exception, "Onboarding email sender configuration is invalid.");
            return false;
        }
    }

    private bool IsEmailConfigured() =>
        !string.IsNullOrWhiteSpace(_emailOptions.Host) &&
        _emailOptions.Port is > 0 and <= 65535 &&
        !string.IsNullOrWhiteSpace(_emailOptions.FromAddress) &&
        !string.IsNullOrWhiteSpace(_emailOptions.UserName) &&
        !string.IsNullOrWhiteSpace(_emailOptions.Password);

    private void EnsureEmailConfigured()
    {
        if (!IsEmailConfigured())
            throw new OnboardingException(
                StatusCodes.Status503ServiceUnavailable,
                "Email verification is unavailable because SMTP delivery is not configured.");
    }

    private void EnsureRazorpayConfigured(bool requireWebhookSecret)
    {
        if (string.IsNullOrWhiteSpace(_razorpayOptions.KeyId) ||
            string.IsNullOrWhiteSpace(_razorpayOptions.KeySecret) ||
            !_razorpayOptions.KeyId.StartsWith("rzp_test_", StringComparison.Ordinal) ||
            (requireWebhookSecret && string.IsNullOrWhiteSpace(_razorpayOptions.WebhookSecret)))
        {
            throw new OnboardingException(
                StatusCodes.Status503ServiceUnavailable,
                "Razorpay Test Mode credentials are not configured. No payment has been initiated or verified.");
        }
    }

    private string HashVerificationCode(string purchaseSecret, string code)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_verificationHashKey));
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{purchaseSecret}:{code}"));
        return Convert.ToHexString(bytes);
    }

    private static string CreateSecureToken() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static bool FixedTimeEquals(string? first, string second)
    {
        if (first is null)
            return false;
        try
        {
            return CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(first),
                Convert.FromHexString(second));
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string FormatRupees(long amountPaise) =>
        $"INR {amountPaise / 100m:N2}";

    private sealed record RazorpayOrder(string Id, long Amount, string Currency);
    private sealed record RazorpayPayment(
        [property: JsonPropertyName("order_id")] string OrderId,
        long Amount,
        string Currency,
        string Status);
}

public static class PaymentSignatureVerifier
{
    public static string ComputeCheckoutSignature(string secret, string orderId, string paymentId) =>
        ComputeHmac(secret, $"{orderId}|{paymentId}");

    public static string ComputeWebhookSignature(string secret, string requestBody) =>
        ComputeHmac(secret, requestBody);

    public static bool VerifyHex(string expectedSignature, string? suppliedSignature)
    {
        if (string.IsNullOrWhiteSpace(suppliedSignature))
            return false;
        try
        {
            return CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(expectedSignature),
                Convert.FromHexString(suppliedSignature));
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string ComputeHmac(string secret, string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));
    }
}
