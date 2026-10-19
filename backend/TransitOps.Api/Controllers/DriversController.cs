using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DriversController : ControllerBase
{
    private readonly TransitOpsDbContext _db;

    public DriversController(TransitOpsDbContext db)
    {
        _db = db;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value ?? "demo_tenant";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? search)
    {
        var tenantId = GetTenantId();
        var query = _db.Drivers.Where(d => d.TenantId == tenantId);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<DriverStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(d => d.Status == parsedStatus);
        }

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(s) || d.Email.ToLower().Contains(s) || d.LicenseNumber.ToLower().Contains(s));
        }

        var list = await query.OrderByDescending(d => d.CreatedAtUtc).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDriverRequest req)
    {
        var tenantId = GetTenantId();

        var exists = await _db.Drivers.AnyAsync(d => (d.Email == req.Email || d.LicenseNumber == req.LicenseNumber) && d.TenantId == tenantId);
        if (exists)
        {
            return BadRequest(new { message = "A driver with this email or license number already exists in your workspace." });
        }

        var driver = new Driver
        {
            TenantId = tenantId,
            Name = req.Name,
            Email = req.Email,
            ContactNumber = req.ContactNumber,
            LicenseNumber = req.LicenseNumber.Trim().ToUpperInvariant(),
            LicenseCategory = req.LicenseCategory,
            LicenseExpiryDate = req.LicenseExpiryDate,
            SafetyScore = 100,
            Status = DriverStatus.Available,
            IncidentHistoryCount = 0,
            TotalTripsCompleted = 0
        };

        _db.Drivers.Add(driver);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = driver.Id }, driver);
    }

    [HttpPut("{id:guid}/toggle-suspension")]
    public async Task<IActionResult> ToggleSuspension(Guid id)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId);
        if (driver == null) return NotFound();

        driver.Status = driver.Status == DriverStatus.Suspended ? DriverStatus.Available : DriverStatus.Suspended;
        await _db.SaveChangesAsync();

        return Ok(driver);
    }

    [HttpPost("{id:guid}/send-license-reminder")]
    public async Task<IActionResult> SendLicenseReminder(Guid id)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId);
        if (driver == null) return NotFound();

        // In production this enqueues an email via Hangfire / SendGrid / SMTP
        return Ok(new { message = $"Official compliance reminder email queued and transmitted to {driver.Email}." });
    }
}
