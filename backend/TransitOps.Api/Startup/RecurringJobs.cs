using Hangfire;
using TransitOps.Infrastructure.BackgroundJobs;

namespace TransitOps.Api.Startup;

/// <summary>Daily Hangfire schedules (times are UTC).</summary>
internal static class RecurringJobs
{
    public static void Register(WebApplication app)
    {
        var recurringJobManager = app.Services.GetRequiredService<IRecurringJobManager>();
        recurringJobManager.AddOrUpdate<IHangfireJobs>(
            "daily-license-expiry-check",
            job => job.CheckExpiringLicensesAsync(),
            Cron.Daily(2));
        // Runs after the licence check so newly expired licences are reflected in scores.
        recurringJobManager.AddOrUpdate<IHangfireJobs>(
            "daily-safety-score-recalculation",
            job => job.RecalculateSafetyScoresAsync(),
            Cron.Daily(2, 30));
        recurringJobManager.AddOrUpdate<IHangfireJobs>(
            "daily-maintenance-audit",
            job => job.AuditVehicleMaintenanceSchedulesAsync(),
            Cron.Daily(3));
        recurringJobManager.AddOrUpdate<IHangfireJobs>(
            "daily-stale-draft-trip-check",
            job => job.ReconcilePendingTripsAsync(),
            Cron.Daily(3, 30));
    }
}
