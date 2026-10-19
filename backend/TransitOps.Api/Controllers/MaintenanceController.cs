using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MaintenanceController : ControllerBase
{
    private readonly TransitOpsDbContext _db;

    public MaintenanceController(TransitOpsDbContext db)
    {
        _db = db;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value ?? "demo_tenant";

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tenantId = GetTenantId();
        var list = await _db.MaintenanceRecords
            .Include(m => m.Vehicle)
            .Where(m => m.TenantId == tenantId)
            .OrderByDescending(m => m.StartDate)
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaintenanceRequest req)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == req.VehicleId && v.TenantId == tenantId);
        if (vehicle == null) return NotFound(new { message = "Vehicle not found." });

        var record = new MaintenanceRecord
        {
            TenantId = tenantId,
            VehicleId = vehicle.Id,
            ServiceType = req.ServiceType,
            Description = req.Description,
            Cost = req.Cost,
            TechnicianNotes = req.TechnicianNotes,
            Status = MaintenanceStatus.Active,
            StartDate = DateTime.UtcNow
        };

        // Transition vehicle status to "In Shop"
        vehicle.Status = VehicleStatus.InShop;

        _db.MaintenanceRecords.Add(record);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = record.Id }, record);
    }

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> CloseWorkOrder(Guid id, [FromBody] CompleteMaintenanceRequest req)
    {
        var tenantId = GetTenantId();
        var record = await _db.MaintenanceRecords
            .Include(m => m.Vehicle)
            .FirstOrDefaultAsync(m => m.Id == id && m.TenantId == tenantId);

        if (record == null) return NotFound();

        record.Status = MaintenanceStatus.Completed;
        record.CompletedDate = DateTime.UtcNow;
        if (req.FinalCost.HasValue) record.Cost = req.FinalCost.Value;
        if (!string.IsNullOrEmpty(req.TechnicianNotes)) record.TechnicianNotes = req.TechnicianNotes;

        // Release vehicle back to Available status
        if (record.Vehicle != null)
        {
            record.Vehicle.Status = VehicleStatus.Available;
        }

        await _db.SaveChangesAsync();
        return Ok(record);
    }
}
