using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Api.Hubs;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MaintenanceController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly IHubContext<TransitOpsHub, ITransitOpsClient> _hub;

    public MaintenanceController(TransitOpsDbContext db, IHubContext<TransitOpsHub, ITransitOpsClient> hub)
    {
        _db = db;
        _hub = hub;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    [HttpGet]
    [Authorize(Roles = "FleetManager,SafetyOfficer,FinancialAnalyst")]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var list = await _db.MaintenanceRecords
            .Include(m => m.Vehicle)
            .Where(m => m.TenantId == tenantId)
            .OrderByDescending(m => m.StartDate)
            .ToListAsync(cancellationToken);

        return Ok(list.Select(ToResponse));
    }

    [HttpPost]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Create([FromBody] CreateMaintenanceRequest req, CancellationToken cancellationToken)
    {
        if (req.VehicleId == Guid.Empty || string.IsNullOrWhiteSpace(req.ServiceType) ||
            string.IsNullOrWhiteSpace(req.Description) || req.Cost < 0)
        {
            return BadRequest(new { message = "Vehicle, service type, description, and a non-negative cost are required." });
        }
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(
            v => v.Id == req.VehicleId && v.TenantId == tenantId,
            cancellationToken);
        if (vehicle == null) return NotFound(new { message = "Vehicle not found." });
        if (vehicle.Status is VehicleStatus.OnTrip or VehicleStatus.Retired)
            return Conflict(new { message = "A vehicle on a trip or retired cannot enter maintenance." });
        if (vehicle.Status == VehicleStatus.InShop)
            return Conflict(new { message = "Vehicle already has an active maintenance hold." });

        var record = new MaintenanceRecord
        {
            TenantId = tenantId,
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            ServiceType = req.ServiceType.Trim(),
            Description = req.Description.Trim(),
            Cost = req.Cost,
            TechnicianNotes = req.TechnicianNotes,
            Status = MaintenanceStatus.Active,
            StartDate = DateTime.UtcNow
        };

        // Transition vehicle status to "In Shop"
        vehicle.Status = VehicleStatus.InShop;

        _db.MaintenanceRecords.Add(record);
        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveMaintenanceUpdated(new { maintenanceId = record.Id, status = record.Status.ToString() });

        return CreatedAtAction(nameof(GetAll), new { id = record.Id }, ToResponse(record));
    }

    [HttpPost("{id:guid}/close")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> CloseWorkOrder(
        Guid id,
        [FromBody] CompleteMaintenanceRequest req,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var record = await _db.MaintenanceRecords
            .Include(m => m.Vehicle)
            .FirstOrDefaultAsync(m => m.Id == id && m.TenantId == tenantId, cancellationToken);

        if (record == null) return NotFound();
        if (record.Status != MaintenanceStatus.Active)
            return Conflict(new { message = "Only active maintenance work orders can be closed." });
        if (req.FinalCost.HasValue && req.FinalCost.Value < 0)
            return BadRequest(new { message = "Final cost cannot be negative." });

        record.Status = MaintenanceStatus.Completed;
        record.CompletedDate = DateTime.UtcNow;
        if (req.FinalCost.HasValue) record.Cost = req.FinalCost.Value;
        if (!string.IsNullOrEmpty(req.TechnicianNotes)) record.TechnicianNotes = req.TechnicianNotes;

        var anotherActiveRecord = await _db.MaintenanceRecords.AnyAsync(
            m => m.VehicleId == record.VehicleId &&
                m.TenantId == tenantId &&
                m.Id != record.Id &&
                m.Status == MaintenanceStatus.Active,
            cancellationToken);
        if (!anotherActiveRecord && record.Vehicle.Status == VehicleStatus.InShop)
        {
            record.Vehicle.Status = VehicleStatus.Available;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveMaintenanceUpdated(new { maintenanceId = record.Id, status = record.Status.ToString() });
        return Ok(ToResponse(record));
    }

    private static MaintenanceRecordResponse ToResponse(MaintenanceRecord record)
    {
        var startDate = AsUtcOffset(record.StartDate);
        return new MaintenanceRecordResponse(
            record.Id,
            record.VehicleId,
            record.Vehicle?.RegistrationNumber ?? string.Empty,
            record.Vehicle?.Name ?? string.Empty,
            record.ServiceType,
            record.Description,
            record.Cost,
            startDate,
            startDate,
            record.CompletedDate.HasValue ? AsUtcOffset(record.CompletedDate.Value) : null,
            record.Status.ToString(),
            record.TechnicianNotes);
    }

    private static DateTimeOffset AsUtcOffset(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
