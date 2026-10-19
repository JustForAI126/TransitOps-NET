using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehiclesController : ControllerBase
{
    private readonly TransitOpsDbContext _db;

    public VehiclesController(TransitOpsDbContext db)
    {
        _db = db;
    }

    private string GetTenantId()
    {
        return User.FindFirst("tenant_id")?.Value ?? "demo_tenant";
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? region, [FromQuery] string? search)
    {
        var tenantId = GetTenantId();
        var query = _db.Vehicles
            .Include(v => v.Documents)
            .Where(v => v.TenantId == tenantId);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<VehicleStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(v => v.Status == parsedStatus);
        }

        if (!string.IsNullOrEmpty(region) && region != "All")
        {
            query = query.Where(v => v.Region == region);
        }

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            query = query.Where(v => v.Name.ToLower().Contains(s) || v.RegistrationNumber.ToLower().Contains(s) || v.Model.ToLower().Contains(s));
        }

        var list = await query.OrderByDescending(v => v.CreatedAtUtc).ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles
            .Include(v => v.Documents)
            .FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);

        if (vehicle == null) return NotFound();
        return Ok(vehicle);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVehicleRequest req)
    {
        var tenantId = GetTenantId();

        var exists = await _db.Vehicles.AnyAsync(v => v.RegistrationNumber == req.RegistrationNumber && v.TenantId == tenantId);
        if (exists)
        {
            return BadRequest(new { message = $"A vehicle with registration number '{req.RegistrationNumber}' already exists." });
        }

        var vehicle = new Vehicle
        {
            TenantId = tenantId,
            RegistrationNumber = req.RegistrationNumber.Trim().ToUpperInvariant(),
            Name = req.Name,
            Model = req.Model,
            Type = req.Type,
            MaxCapacityKg = req.MaxCapacityKg,
            CurrentOdometerKm = req.CurrentOdometerKm,
            AcquisitionCost = req.AcquisitionCost,
            Status = VehicleStatus.Available,
            Region = req.Region,
            RevenueGenerated = 0,
            FuelEfficiencyKmPerLiter = req.Type == VehicleType.Van ? 7.5m : 3.8m
        };

        // Add standard compliance documents
        vehicle.Documents.Add(new VehicleDocument
        {
            Type = "Comprehensive Commercial Insurance",
            ExpiryDate = DateTime.UtcNow.AddMonths(12),
            Status = "Valid"
        });
        vehicle.Documents.Add(new VehicleDocument
        {
            Type = "State Pollution / Fitness Certificate",
            ExpiryDate = DateTime.UtcNow.AddMonths(6),
            Status = "Valid"
        });

        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = vehicle.Id }, vehicle);
    }

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateVehicleStatusDto req)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (vehicle == null) return NotFound();

        if (Enum.TryParse<VehicleStatus>(req.Status, true, out var newStatus))
        {
            vehicle.Status = newStatus;
            await _db.SaveChangesAsync();
            return Ok(vehicle);
        }

        return BadRequest(new { message = "Invalid vehicle status." });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Retire(Guid id)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (vehicle == null) return NotFound();

        vehicle.Status = VehicleStatus.Retired;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Vehicle retired safely." });
    }
}
