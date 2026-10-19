using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Application.Services;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Infrastructure.Services;

public class KpiService : IKpiService
{
    private readonly TransitOpsDbContext _db;

    public KpiService(TransitOpsDbContext db)
    {
        _db = db;
    }

    public async Task<FleetKpiDto> GetFleetKpisAsync(string tenantId, CancellationToken ct = default)
    {
        var vehicleQuery = _db.Vehicles.Where(v => v.TenantId == tenantId);
        var tripQuery = _db.Trips.Where(t => t.TenantId == tenantId);

        var totalVehicles = await vehicleQuery.CountAsync(v => v.Status != VehicleStatus.Retired, ct);
        var activeVehicles = await vehicleQuery.CountAsync(v => v.Status == VehicleStatus.OnTrip, ct);
        var activeDispatches = await tripQuery.CountAsync(t => t.Status == TripStatus.Dispatched, ct);
        var availableAssets = await vehicleQuery.CountAsync(v => v.Status == VehicleStatus.Available, ct);
        var maintenanceHolds = await vehicleQuery.CountAsync(v => v.Status == VehicleStatus.InShop, ct);
        var pendingDepartures = await tripQuery.CountAsync(t => t.Status == TripStatus.Draft, ct);
        var driversOnDuty = await _db.Drivers.CountAsync(
            d => d.TenantId == tenantId && d.Status == DriverStatus.OnDuty,
            ct);

        double utilizationRate = totalVehicles > 0
            ? Math.Round(((double)activeVehicles / totalVehicles) * 100.0, 1)
            : 0.0;

        return new FleetKpiDto(
            TotalVehicles: totalVehicles,
            ActiveVehicles: activeVehicles,
            ActiveDispatches: activeDispatches,
            AvailableAssets: availableAssets,
            MaintenanceHolds: maintenanceHolds,
            FleetUtilizationRate: utilizationRate,
            TotalTripsInProgress: activeDispatches,
            PendingDepartures: pendingDepartures,
            DriversOnDuty: driversOnDuty
        );
    }

    public async Task<DriverKpiDto> GetDriverKpisAsync(string tenantId, Guid? driverId = null, CancellationToken ct = default)
    {
        var query = _db.Trips.Where(t => t.TenantId == tenantId);
        if (driverId.HasValue)
        {
            query = query.Where(t => t.DriverId == driverId.Value);
        }

        var today = DateTime.UtcNow.Date;

        var pendingDepartures = await query.CountAsync(t => t.Status == TripStatus.Draft, ct);
        var activeDeliveries = await query.CountAsync(t => t.Status == TripStatus.Dispatched, ct);
        var deliveredRunsToday = await query.CountAsync(t => t.Status == TripStatus.Completed && t.CompletedAtUtc >= today, ct);
        var totalTripsCompleted = await query.CountAsync(t => t.Status == TripStatus.Completed, ct);

        return new DriverKpiDto(
            PendingDepartures: pendingDepartures,
            ActiveDeliveries: activeDeliveries,
            DeliveredRunsToday: deliveredRunsToday,
            TotalTripsCompleted: totalTripsCompleted,
            OnTimeDepartureRate: null
        );
    }

    public async Task<SafetyKpiDto> GetSafetyKpisAsync(string tenantId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var warningThreshold = today.AddDays(30);

        var driverStats = await _db.Drivers
            .Where(d => d.TenantId == tenantId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                ExpiredCount = g.Count(d => d.LicenseExpiryDate < today),
                ExpiringSoonCount = g.Count(d => d.LicenseExpiryDate >= today && d.LicenseExpiryDate <= warningThreshold),
                SuspendedCount = g.Count(d => d.Status == DriverStatus.Suspended),
                CompliantCount = g.Count(d => d.LicenseExpiryDate >= today && d.Status != DriverStatus.Suspended),
                AverageSafetyScore = g.Average(d => (double?)d.SafetyScore) ?? 100.0
            })
            .FirstOrDefaultAsync(ct);

        var activeWorkOrders = await _db.MaintenanceRecords
            .Where(m => m.TenantId == tenantId && m.Status == MaintenanceStatus.Active)
            .CountAsync(ct);

        return new SafetyKpiDto(
            ExpiredLicenses: driverStats?.ExpiredCount ?? 0,
            ExpiringSoon: driverStats?.ExpiringSoonCount ?? 0,
            SuspendedDrivers: driverStats?.SuspendedCount ?? 0,
            CompliantDrivers: driverStats?.CompliantCount ?? 0,
            InShopInspectionLocks: activeWorkOrders,
            AverageSafetyScore: Math.Round(driverStats?.AverageSafetyScore ?? 100.0, 1)
        );
    }

    public async Task<FinancialKpiDto> GetFinancialKpisAsync(string tenantId, CancellationToken ct = default)
    {
        var maintenanceCost = await _db.MaintenanceRecords
            .Where(m => m.TenantId == tenantId)
            .SumAsync(m => (decimal?)m.Cost, ct) ?? 0m;

        var loggedFuelCost = await _db.Expenses
            .Where(e => e.TenantId == tenantId && e.Type == ExpenseType.Fuel)
            .SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

        var otherExpenses = await _db.Expenses
            .Where(e => e.TenantId == tenantId && e.Type != ExpenseType.Fuel)
            .SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

        var tripStats = await _db.Trips
            .Where(t => t.TenantId == tenantId && t.Status == TripStatus.Completed)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalRevenue = g.Sum(t => t.Revenue),
                TotalPlannedDistanceKm = g.Sum(t => t.PlannedDistanceKm)
            })
            .FirstOrDefaultAsync(ct);

        decimal grossRevenue = tripStats?.TotalRevenue ?? 0m;
        decimal fuelSpend = loggedFuelCost;
        decimal totalOpex = maintenanceCost + fuelSpend + otherExpenses;
        decimal netProfit = grossRevenue - totalOpex;
        decimal netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100m : 0m;
        decimal costPerKm = (tripStats?.TotalPlannedDistanceKm > 0)
            ? totalOpex / tripStats.TotalPlannedDistanceKm
            : 0m;

        return new FinancialKpiDto(
            TotalOpex: totalOpex,
            FuelSpend: fuelSpend,
            MaintenanceSpend: maintenanceCost,
            GrossRevenue: grossRevenue,
            NetProfit: netProfit,
            NetMarginPercentage: Math.Round(netMargin, 1),
            CostPerKm: Math.Round(costPerKm, 2),
            Currency: "INR"
        );
    }
}
