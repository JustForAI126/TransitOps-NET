using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.Reports;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
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

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value ?? "demo_tenant";

    [HttpGet("export/csv/trips")]
    public async Task<IActionResult> ExportTripsCsv()
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
            .ToListAsync();

        var bytes = _csvService.ExportToCsv(trips);
        return File(bytes, "text/csv", $"TransitOps_Trips_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("export/pdf/ledger")]
    public async Task<IActionResult> ExportFinancialLedgerPdf()
    {
        var tenantId = GetTenantId();
        var completedTrips = await _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .Where(t => t.TenantId == tenantId && t.Status == TripStatus.Completed)
            .ToListAsync();

        var maintenanceSpend = await _db.MaintenanceRecords
            .Where(m => m.TenantId == tenantId)
            .SumAsync(m => (decimal?)m.Cost) ?? 0m;

        var fuelSpend = await _db.Expenses
            .Where(e => e.TenantId == tenantId && e.Type == ExpenseType.Fuel)
            .SumAsync(e => (decimal?)e.Amount) ?? 0m;

        var otherExpenses = await _db.Expenses
            .Where(e => e.TenantId == tenantId && e.Type != ExpenseType.Fuel)
            .SumAsync(e => (decimal?)e.Amount) ?? 0m;

        decimal totalOpex = maintenanceSpend + fuelSpend + otherExpenses;
        decimal grossRevenue = completedTrips.Sum(t => t.Revenue);
        decimal netProfit = grossRevenue - totalOpex;

        var pdfBytes = _pdfService.GenerateFinancialLedgerPdf(completedTrips, totalOpex, grossRevenue, netProfit);
        return File(pdfBytes, "application/pdf", $"TransitOps_Financial_Audit_{DateTime.UtcNow:yyyyMMdd}.pdf");
    }

    [HttpGet("export/pdf/trip/{tripId:guid}")]
    public async Task<IActionResult> ExportTripTurnInReceipt(Guid tripId)
    {
        var tenantId = GetTenantId();
        var trip = await _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .FirstOrDefaultAsync(t => t.Id == tripId && t.TenantId == tenantId);

        if (trip == null) return NotFound();

        var pdfBytes = _pdfService.GenerateTripTurnInReceiptPdf(trip);
        return File(pdfBytes, "application/pdf", $"Receipt_{trip.TripCode}.pdf");
    }
}
