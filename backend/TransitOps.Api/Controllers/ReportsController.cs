using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.Reports;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly ICsvExportService _csvService;
    private readonly IPdfReportService _pdfService;

    public ReportsController(TransitOpsDbContext db, ICsvExportService csvService, IPdfReportService pdfService)
    {
        _db = db;
        _csvService = csvService;
        _pdfService = pdfService;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    private string? GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
        User.FindFirst("sub")?.Value;

    [HttpGet("export/csv/trips")]
    [Authorize(Roles = "FleetManager,FinancialAnalyst")]
    public async Task<IActionResult> ExportTripsCsv(CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var trips = await _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .Where(t => t.TenantId == tenantId)
            .Select(t => new
            {
                TripCode = t.TripCode,
                Source = t.Source,
                Destination = t.Destination,
                Vehicle = t.Vehicle.RegistrationNumber,
                Driver = t.Driver.Name,
                CargoKg = t.CargoWeightKg,
                DistanceKm = t.PlannedDistanceKm,
                RevenueINR = t.Revenue,
                Status = t.Status.ToString(),
                CreatedAt = t.CreatedAtUtc.ToString("yyyy-MM-dd HH:mm")
            })
            .ToListAsync(cancellationToken);

        var bytes = _csvService.ExportToCsv(trips);
        return File(bytes, "text/csv", $"TransitOps_Trips_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("export/pdf/ledger")]
    [Authorize(Roles = "FinancialAnalyst")]
    public async Task<IActionResult> ExportFinancialLedgerPdf(CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var completedTrips = await _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .Where(t => t.TenantId == tenantId && t.Status == TripStatus.Completed)
            .ToListAsync(cancellationToken);

        var maintenanceSpend = await _db.MaintenanceRecords
            .Where(m => m.TenantId == tenantId)
            .SumAsync(m => (decimal?)m.Cost, cancellationToken) ?? 0m;

        var fuelSpend = await _db.Expenses
            .Where(e => e.TenantId == tenantId && e.Type == ExpenseType.Fuel)
            .SumAsync(e => (decimal?)e.Amount, cancellationToken) ?? 0m;

        var otherExpenses = await _db.Expenses
            .Where(e => e.TenantId == tenantId && e.Type != ExpenseType.Fuel)
            .SumAsync(e => (decimal?)e.Amount, cancellationToken) ?? 0m;

        decimal totalOpex = maintenanceSpend + fuelSpend + otherExpenses;
        decimal grossRevenue = completedTrips.Sum(t => t.Revenue);
        decimal netProfit = grossRevenue - totalOpex;

        var pdfBytes = _pdfService.GenerateFinancialLedgerPdf(completedTrips, totalOpex, grossRevenue, netProfit);
        return File(pdfBytes, "application/pdf", $"TransitOps_Financial_Audit_{DateTime.UtcNow:yyyyMMdd}.pdf");
    }

    [HttpGet("export/pdf/fleet-roi")]
    [Authorize(Roles = "FleetManager")]
    [Produces("application/pdf")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ExportFleetRoiPdf(CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var vehicles = await _db.Vehicles
            .AsNoTracking()
            .Where(vehicle => vehicle.TenantId == tenantId)
            .OrderBy(vehicle => vehicle.RegistrationNumber)
            .ToListAsync(cancellationToken);
        var tenantTrips = await _db.Trips
            .AsNoTracking()
            .Where(trip => trip.TenantId == tenantId)
            .Select(trip => new
            {
                trip.VehicleId,
                trip.Status,
                trip.PlannedDistanceKm,
                trip.Revenue
            })
            .ToListAsync(cancellationToken);
        var revenueByVehicle = tenantTrips
            .Where(trip => trip.Status == TripStatus.Completed)
            .GroupBy(trip => trip.VehicleId)
            .ToDictionary(group => group.Key, group => group.Sum(trip => trip.Revenue));
        var maintenanceByVehicle = await _db.MaintenanceRecords
            .AsNoTracking()
            .Where(record => record.TenantId == tenantId)
            .GroupBy(record => record.VehicleId)
            .Select(group => new { VehicleId = group.Key, Cost = group.Sum(record => record.Cost) })
            .ToDictionaryAsync(result => result.VehicleId, result => result.Cost, cancellationToken);
        var fuelByVehicle = await _db.Expenses
            .AsNoTracking()
            .Where(expense => expense.TenantId == tenantId &&
                              expense.Type == ExpenseType.Fuel &&
                              expense.VehicleId.HasValue)
            .GroupBy(expense => expense.VehicleId!.Value)
            .Select(group => new { VehicleId = group.Key, Cost = group.Sum(expense => expense.Amount) })
            .ToDictionaryAsync(result => result.VehicleId, result => result.Cost, cancellationToken);

        var summaries = vehicles.Select(vehicle =>
        {
            var revenue = revenueByVehicle.GetValueOrDefault(vehicle.Id);
            var maintenance = maintenanceByVehicle.GetValueOrDefault(vehicle.Id);
            var fuel = fuelByVehicle.GetValueOrDefault(vehicle.Id);
            var acquisition = vehicle.AcquisitionCost;
            var operatingProfit = revenue - maintenance - fuel;
            var roiPercent = acquisition > 0m ? operatingProfit / acquisition * 100m : 0m;
            return new VehicleRoiSummary(
                vehicle.RegistrationNumber,
                vehicle.Name,
                vehicle.Type.ToString(),
                acquisition,
                revenue,
                maintenance,
                fuel,
                operatingProfit,
                roiPercent);
        }).ToArray();
        var nonRetiredVehicleCount = vehicles.Count(vehicle => vehicle.Status != VehicleStatus.Retired);
        var completedTripRows = tenantTrips.Where(trip => trip.Status == TripStatus.Completed).ToArray();
        var totalOperatingCost = summaries.Sum(summary => summary.MaintenanceCost + summary.FuelCost);
        var dashboardMetrics = new FleetRoiDashboardMetrics(
            ActiveVehicles: vehicles.Count(vehicle => vehicle.Status == VehicleStatus.OnTrip),
            AvailableVehicles: vehicles.Count(vehicle => vehicle.Status == VehicleStatus.Available),
            VehiclesInMaintenance: vehicles.Count(vehicle => vehicle.Status == VehicleStatus.InShop),
            ActiveTrips: tenantTrips.Count(trip => trip.Status == TripStatus.Dispatched),
            PendingTrips: tenantTrips.Count(trip => trip.Status == TripStatus.Draft),
            DriversOnDuty: await _db.Drivers.CountAsync(
                driver => driver.TenantId == tenantId && driver.Status == DriverStatus.OnDuty,
                cancellationToken),
            FleetUtilizationPercent: nonRetiredVehicleCount > 0
                ? decimal.Round((decimal)vehicles.Count(vehicle => vehicle.Status == VehicleStatus.OnTrip) /
                                nonRetiredVehicleCount * 100m, 1)
                : 0m,
            AverageRevenuePerCompletedTrip: completedTripRows.Length > 0
                ? completedTripRows.Average(trip => trip.Revenue)
                : 0m,
            AverageTripDistanceKm: completedTripRows.Length > 0
                ? (decimal)completedTripRows.Average(trip => trip.PlannedDistanceKm)
                : 0m,
            AverageOperatingCostPerVehicle: summaries.Length > 0
                ? totalOperatingCost / summaries.Length
                : 0m,
            AverageOperatingProfitPerVehicle: summaries.Length > 0
                ? summaries.Average(summary => summary.OperatingProfit)
                : 0m,
            AverageVehicleRoiPercent: summaries.Length > 0
                ? summaries.Average(summary => summary.RoiPercent)
                : 0m);

        var pdfBytes = _pdfService.GenerateFleetRoiPdf(summaries, dashboardMetrics);
        return File(pdfBytes, "application/pdf", $"TransitOps_Fleet_ROI_{DateTime.UtcNow:yyyyMMdd}.pdf");
    }

    [HttpGet("export/pdf/trip/{tripId:guid}")]
    [Authorize(Roles = "FleetManager,Driver")]
    public async Task<IActionResult> ExportTripTurnInReceipt(Guid tripId, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var trip = await _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .FirstOrDefaultAsync(t => t.Id == tripId && t.TenantId == tenantId, cancellationToken);

        if (trip == null) return NotFound();

        if (User.IsInRole(UserRole.Driver.ToString()) &&
            !string.Equals(trip.Driver.IdentityUserId, GetUserId(), StringComparison.Ordinal))
        {
            return Forbid();
        }

        var pdfBytes = _pdfService.GenerateTripTurnInReceiptPdf(trip);
        return File(pdfBytes, "application/pdf", $"Receipt_{trip.TripCode}.pdf");
    }
}
