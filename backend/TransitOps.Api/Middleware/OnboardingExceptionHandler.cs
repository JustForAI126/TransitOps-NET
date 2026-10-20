using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TransitOps.Application.Services;

namespace TransitOps.Api.Middleware;

internal sealed class OnboardingExceptionHandler(
    ILogger<OnboardingExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not OnboardingException onboardingException)
            return false;

        if (onboardingException.StatusCode >= StatusCodes.Status500InternalServerError)
            logger.LogError(exception, "Onboarding request failed.");
        else
            logger.LogWarning("Onboarding request rejected with status {StatusCode}: {Message}",
                onboardingException.StatusCode,
                onboardingException.Message);

        httpContext.Response.StatusCode = onboardingException.StatusCode;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = onboardingException.StatusCode,
            Title = "Onboarding request could not be completed",
            Detail = onboardingException.Message,
            Instance = httpContext.Request.Path
        }, cancellationToken);
        return true;
    }
}
