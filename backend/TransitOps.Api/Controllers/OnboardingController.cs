using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TransitOps.Application.DTOs;
using TransitOps.Application.Services;

namespace TransitOps.Api.Controllers;

/// <summary>Public endpoints for verified SaaS purchase and organization onboarding.</summary>
[ApiController]
[Route("api/onboarding")]
[AllowAnonymous]
[EnableRateLimiting("onboarding")]
public sealed class OnboardingController(ISaasOnboardingService onboardingService) : ControllerBase
{
    /// <summary>Returns the server-authoritative subscription plan catalog.</summary>
    /// <remarks>Read-only and loaded on every home/purchase page view, so it must not use up the purchase rate limit.</remarks>
    [HttpGet("plans")]
    [DisableRateLimiting]
    [ProducesResponseType<IReadOnlyList<SubscriptionPlanResponse>>(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<SubscriptionPlanResponse>> GetPlans() =>
        Ok(onboardingService.GetPlans());

    /// <summary>Starts email verification for a new organization purchase.</summary>
    [HttpPost("begin")]
    [ProducesResponseType<PurchaseSessionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<PurchaseSessionResponse>> Begin(
        [FromBody] BeginOnboardingRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.BeginAsync(request, cancellationToken));

    /// <summary>Verifies the email code sent to the organization owner.</summary>
    [HttpPost("verify-email")]
    [ProducesResponseType<EmailVerificationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailVerificationResponse>> VerifyEmail(
        [FromBody] VerifyOnboardingEmailRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.VerifyEmailAsync(request, cancellationToken));

    /// <summary>Sends a replacement email verification code with bounded retries.</summary>
    [HttpPost("resend-verification")]
    [ProducesResponseType<VerificationDeliveryResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<VerificationDeliveryResponse>> ResendVerification(
        [FromBody] ResendOnboardingVerificationRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.ResendVerificationAsync(request, cancellationToken));

    /// <summary>Creates a Razorpay order using the configured server-side plan amount.</summary>
    [HttpPost("orders")]
    [ProducesResponseType<CreatePaymentOrderResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CreatePaymentOrderResponse>> CreateOrder(
        [FromBody] CreatePaymentOrderRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.CreatePaymentOrderAsync(request, cancellationToken));

    /// <summary>Verifies Razorpay's signature and confirms a captured payment server-side.</summary>
    [HttpPost("verify-payment")]
    [ProducesResponseType<PaymentVerificationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaymentVerificationResponse>> VerifyPayment(
        [FromBody] VerifyPaymentRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.VerifyPaymentAsync(request, cancellationToken));

    /// <summary>Receives signed Razorpay webhook events.</summary>
    [HttpPost("webhook/razorpay")]
    [RequestSizeLimit(65_536)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RazorpayWebhook(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var requestBody = await reader.ReadToEndAsync(cancellationToken);
        await onboardingService.HandleWebhookAsync(
            requestBody,
            Request.Headers["X-Razorpay-Signature"],
            Request.Headers["X-Razorpay-Event-Id"],
            cancellationToken);
        return NoContent();
    }

    /// <summary>Retries receipt or administrator setup email delivery after a verified payment.</summary>
    [HttpPost("retry-emails")]
    [ProducesResponseType<PaymentVerificationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaymentVerificationResponse>> RetryEmails(
        [FromBody] RetryOnboardingEmailsRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.RetryEmailsAsync(request, cancellationToken));

    /// <summary>Returns onboarding progress to a browser holding the purchase capability.</summary>
    [HttpPost("progress")]
    [ProducesResponseType<PurchaseProgressResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PurchaseProgressResponse>> GetProgress(
        [FromBody] RetryOnboardingEmailsRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.GetProgressAsync(request, cancellationToken));

    /// <summary>Creates the first organization-scoped administrator from a single-use setup link.</summary>
    [HttpPost("complete-account-setup")]
    [ProducesResponseType<AccountSetupResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status410Gone)]
    public async Task<ActionResult<AccountSetupResponse>> CompleteAccountSetup(
        [FromBody] CompleteAccountSetupRequest request,
        CancellationToken cancellationToken) =>
        Ok(await onboardingService.CompleteAccountSetupAsync(request, cancellationToken));
}
