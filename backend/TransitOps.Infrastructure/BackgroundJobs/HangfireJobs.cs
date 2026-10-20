using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TransitOps.Application.Services;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Infrastructure.BackgroundJobs;

public interface IHangfireJobs
{
    Task CheckExpiringLicensesAsync();
    Task AuditVehicleMaintenanceSchedulesAsync();
    Task ReconcilePendingTripsAsync();
    Task RecalculateSafetyScoresAsync();
}

public class HangfireJobs : IHangfireJobs
{
    private readonly TransitOpsDbContext _db;
    private readonly ILogger<HangfireJobs> _logger;
    private readonly ISafetyScoreService _safety;

    public HangfireJobs(TransitOpsDbContext db, ILogger<HangfireJobs> logger, ISafetyScoreService safety)
    {
        _db = db;
        _logger = logger;
        _safety = safety;
    }

    public async Task RecalculateSafetyScoresAsync()
    {
        var changed = await _safety.RecalculateAllAsync();
        _logger.LogInformation("Hangfire: Recalculated safety scores, {Count} driver(s) changed", changed);
    }

    public async Task CheckExpiringLicensesAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var warningThreshold = today.AddDays(30);

        var driversToReview = await _db.Drivers
            .Where(d => d.LicenseExpiryDate <= warningThreshold)
            .ToListAsync();

        foreach (var driver in driversToReview)
        {
            if (driver.LicenseExpiryDate < today && driver.Status != DriverStatus.Suspended)
            {
                driver.Status = DriverStatus.Suspended;
                _logger.LogWarning("Hangfire: Auto-suspended driver {Name} (License expired on {Date})", driver.Name, driver.LicenseExpiryDate);
            }
            else if (driver.LicenseExpiryDate <= warningThreshold)
            {
                _logger.LogInformation("Hangfire: Driver {Name} license expires soon on {Date}", driver.Name, driver.LicenseExpiryDate);
            }
        }

        await _db.SaveChangesAsync();
    }

    public async Task AuditVehicleMaintenanceSchedulesAsync()
    {
        var vehicles = await _db.Vehicles
            .Where(v => v.Status == VehicleStatus.Available)
            .ToListAsync();

        foreach (var vehicle in vehicles)
        {
            // If odometer exceeds 10,000 km intervals since last maintenance, trigger proactive check
            if (vehicle.CurrentOdometerKm > 0 && vehicle.CurrentOdometerKm % 10000 < 500)
            {
                _logger.LogInformation("Hangfire: Vehicle {Reg} is due for regular maintenance inspection at {Km} km", vehicle.RegistrationNumber, vehicle.CurrentOdometerKm);
            }
        }
    }

    public async Task ReconcilePendingTripsAsync()
    {
        var staleThreshold = DateTime.UtcNow.AddHours(-48);
        var staleTrips = await _db.Trips
            .Where(t => t.Status == TripStatus.Draft && t.CreatedAtUtc < staleThreshold)
            .ToListAsync();

        _logger.LogInformation("Hangfire: Found {Count} stale draft trips older than 48 hours", staleTrips.Count);
    }
}
