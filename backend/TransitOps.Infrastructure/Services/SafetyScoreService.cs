using Microsoft.EntityFrameworkCore;
using TransitOps.Application.Safety;
using TransitOps.Application.Services;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Infrastructure.Services;

public class SafetyScoreService : ISafetyScoreService
{
    private readonly TransitOpsDbContext _db;

    public SafetyScoreService(TransitOpsDbContext db)
    {
        _db = db;
    }

    public async Task<SafetyScoreResult?> GetBreakdownAsync(string tenantId, Guid driverId, CancellationToken ct = default)
    {
        var driver = await _db.Drivers.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == driverId && d.TenantId == tenantId, ct);
        return driver is null ? null : await CalculateAsync(driver, ct);
    }

    public async Task<SafetyScoreResult?> RecalculateAsync(Guid driverId, CancellationToken ct = default)
    {
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == driverId, ct);
        if (driver is null) return null;
        var result = await CalculateAsync(driver, ct);
        driver.SafetyScore = result.Score;
        return result;
    }

    public async Task<int> RecalculateAllAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var drivers = await _db.Drivers
            .Where(d => tenantId == null || d.TenantId == tenantId)
            .ToListAsync(ct);
        var changed = 0;
        foreach (var driver in drivers)
        {
            var result = await CalculateAsync(driver, ct);
            if (driver.SafetyScore == result.Score) continue;
            driver.SafetyScore = result.Score;
            changed++;
        }
        await _db.SaveChangesAsync(ct);
        return changed;
    }

    private async Task<SafetyScoreResult> CalculateAsync(Driver driver, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var windowStart = DateTime.UtcNow.AddDays(-SafetyScoreCalculator.FuelWindowDays);
        var completed = _db.Trips.AsNoTracking()
            .Where(t => t.DriverId == driver.Id && t.Status == TripStatus.Completed);

        var completedCount = await completed.CountAsync(ct);
        var recent = await completed
            .Where(t => t.CompletedAtUtc >= windowStart && t.FuelConsumedLiters != null)
            .Select(t => new SafetyTripSample(
                t.PlannedDistanceKm,
                t.FuelConsumedLiters!.Value,
                t.Vehicle.FuelEfficiencyKmPerLiter,
                t.CompletedAtUtc!.Value))
            .ToListAsync(ct);

        return SafetyScoreCalculator.Calculate(
            new SafetyScoreInput(driver.IncidentHistoryCount, driver.LicenseExpiryDate, completedCount, recent),
            today);
    }
}
