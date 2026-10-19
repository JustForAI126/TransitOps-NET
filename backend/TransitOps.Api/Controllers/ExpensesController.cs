using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly TransitOpsDbContext _db;

    public ExpensesController(TransitOpsDbContext db)
    {
        _db = db;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value ?? "demo_tenant";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? type)
    {
        var tenantId = GetTenantId();
        var query = _db.Expenses
            .Include(e => e.Vehicle)
            .Include(e => e.Trip)
            .Where(e => e.TenantId == tenantId);

        if (!string.IsNullOrEmpty(type) && Enum.TryParse<ExpenseType>(type, true, out var parsedType))
        {
            query = query.Where(e => e.Type == parsedType);
        }

        var list = await query.OrderByDescending(e => e.ExpenseDate).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest req)
    {
        var tenantId = GetTenantId();

        var record = new ExpenseRecord
        {
            TenantId = tenantId,
            VehicleId = req.VehicleId,
            TripId = req.TripId,
            Type = req.Type,
            Amount = req.Amount,
            Liters = req.Liters,
            OdometerReading = req.OdometerReading,
            ExpenseDate = req.ExpenseDate ?? DateTime.UtcNow,
            Notes = req.Notes
        };

        _db.Expenses.Add(record);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = record.Id }, record);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenantId = GetTenantId();
        var record = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);
        if (record == null) return NotFound();

        _db.Expenses.Remove(record);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
