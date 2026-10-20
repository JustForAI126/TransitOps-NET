using TransitOps.Application.DTOs;

namespace TransitOps.Application.Services;

public interface ISaasOnboardingService
{
    IReadOnlyList<SubscriptionPlanResponse> GetPlans();

    Task<PurchaseSessionResponse> BeginAsync(
        BeginOnboardingRequest request,
        CancellationToken cancellationToken);

    Task<EmailVerificationResponse> VerifyEmailAsync(
        VerifyOnboardingEmailRequest request,
        CancellationToken cancellationToken);

    Task<VerificationDeliveryResponse> ResendVerificationAsync(
        ResendOnboardingVerificationRequest request,
        CancellationToken cancellationToken);

    Task<CreatePaymentOrderResponse> CreatePaymentOrderAsync(
        CreatePaymentOrderRequest request,
        CancellationToken cancellationToken);

    Task<PaymentVerificationResponse> VerifyPaymentAsync(
        VerifyPaymentRequest request,
        CancellationToken cancellationToken);

    Task HandleWebhookAsync(
        string requestBody,
        string? signature,
        string? eventId,
        CancellationToken cancellationToken);

    Task<PaymentVerificationResponse> RetryEmailsAsync(
        RetryOnboardingEmailsRequest request,
        CancellationToken cancellationToken);

    Task<PurchaseProgressResponse> GetProgressAsync(
        RetryOnboardingEmailsRequest request,
        CancellationToken cancellationToken);

    Task<AccountSetupResponse> CompleteAccountSetupAsync(
        CompleteAccountSetupRequest request,
        CancellationToken cancellationToken);
}

public sealed class OnboardingException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
