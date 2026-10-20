using System.ComponentModel.DataAnnotations;

namespace TransitOps.Application.DTOs;

/// <summary>Public plan details available for purchase.</summary>
public sealed record SubscriptionPlanResponse(
    string Id,
    string Name,
    long AmountPaise,
    string Currency,
    int TermMonths,
    IReadOnlyList<string> Features);

/// <summary>Information needed to begin verified organization onboarding.</summary>
public sealed record BeginOnboardingRequest
{
    [Required, StringLength(200, MinimumLength = 2)]
    public required string OrganizationName { get; init; }

    [Required, StringLength(200, MinimumLength = 2)]
    public required string FullName { get; init; }

    [Required, EmailAddress, StringLength(256)]
    public required string Email { get; init; }
}

/// <summary>Short-lived capability returned for continuing the same purchase flow.</summary>
public sealed record PurchaseSessionResponse(
    Guid PurchaseId,
    string PurchaseSecret,
    bool VerificationEmailSent,
    string Message);

/// <summary>Result of delivering or retrying an email verification code.</summary>
public sealed record VerificationDeliveryResponse(bool EmailSent, string Message);

/// <summary>Requests a replacement email verification code for the same purchase.</summary>
public sealed record ResendOnboardingVerificationRequest
{
    [Required]
    public required Guid PurchaseId { get; init; }

    [Required, StringLength(128, MinimumLength = 32)]
    public required string PurchaseSecret { get; init; }
}

/// <summary>Email verification code submitted for a purchase session.</summary>
public sealed record VerifyOnboardingEmailRequest
{
    [Required]
    public required Guid PurchaseId { get; init; }

    [Required, StringLength(128, MinimumLength = 32)]
    public required string PurchaseSecret { get; init; }

    [Required, StringLength(6, MinimumLength = 6)]
    public required string Code { get; init; }
}

/// <summary>Confirmation that the purchase email address is verified.</summary>
public sealed record EmailVerificationResponse(bool Verified, string Message);

/// <summary>Request to create a Razorpay test-mode payment order.</summary>
public sealed record CreatePaymentOrderRequest
{
    [Required]
    public required Guid PurchaseId { get; init; }

    [Required, StringLength(128, MinimumLength = 32)]
    public required string PurchaseSecret { get; init; }

    [Required, StringLength(64)]
    public required string PlanId { get; init; }
}

/// <summary>Server-created Razorpay order details for the browser checkout.</summary>
public sealed record CreatePaymentOrderResponse(
    string OrderId,
    string PublicKeyId,
    long AmountPaise,
    string Currency,
    string PlanId,
    string PlanName,
    int TermMonths);

/// <summary>Payment identifiers and signature returned by Razorpay Checkout.</summary>
public sealed record VerifyPaymentRequest
{
    [Required, StringLength(64)]
    public required string RazorpayOrderId { get; init; }

    [Required, StringLength(64)]
    public required string RazorpayPaymentId { get; init; }

    [Required, StringLength(128)]
    public required string RazorpaySignature { get; init; }
}

/// <summary>Result of server-side payment verification and email delivery.</summary>
public sealed record PaymentVerificationResponse(
    bool Verified,
    bool ReceiptEmailSent,
    bool SetupEmailSent,
    bool SetupCompleted,
    string Message);

/// <summary>Capability credentials for retrying email delivery after payment.</summary>
public sealed record RetryOnboardingEmailsRequest
{
    [Required]
    public required Guid PurchaseId { get; init; }

    [Required, StringLength(128, MinimumLength = 32)]
    public required string PurchaseSecret { get; init; }
}

/// <summary>Purchase progress returned to the owner holding the purchase capability.</summary>
public sealed record PurchaseProgressResponse(
    bool EmailVerified,
    bool PaymentVerified,
    bool ReceiptEmailSent,
    bool SetupEmailSent,
    bool SetupCompleted,
    string? OrderId,
    string? PlanId,
    DateTimeOffset? SetupLinkExpiresAtUtc,
    string PaymentStatus);

/// <summary>Single-use setup token and the new administrator password.</summary>
public sealed record CompleteAccountSetupRequest
{
    [Required, StringLength(256, MinimumLength = 32)]
    public required string Token { get; init; }

    [Required, StringLength(128, MinimumLength = 10)]
    public required string Password { get; init; }
}

/// <summary>New organization administrator identity created during setup.</summary>
public sealed record AccountSetupResponse(
    string Id,
    string FullName,
    string Email,
    string Role,
    string TenantId);
