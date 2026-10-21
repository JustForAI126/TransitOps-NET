using Hangfire.Dashboard;
using TransitOps.Domain.Enums;

namespace TransitOps.Api.Startup;

/// <summary>Hangfire dashboard is limited to authenticated Fleet Managers.</summary>
internal sealed class FleetManagerDashboardAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        return httpContext.User.Identity?.IsAuthenticated == true &&
            httpContext.User.IsInRole(UserRole.FleetManager.ToString());
    }
}
