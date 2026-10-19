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
public class ExpensesController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly IHubContext<TransitOpsHub, ITransitOpsClient> _hub;

    public ExpensesController(TransitOpsDbContext db, IHubContext<TransitOpsHub, ITransitOpsClient> hub)
    {
        _db = db;
        _hub = hub;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    [HttpGet]
    [Authorize(Roles = "FleetManager,FinancialAnalyst")]
    public async Task<IActionResult> GetAll([FromQuery] string? type, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var query = _db.Expenses
            .Where(e => e.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(type))
        {
            if (!Enum.TryParse<ExpenseType>(type, true, out var parsedType) ||
                !Enum.IsDefined(parsedType))
                return BadRequest(new { message = "Invalid expense type filter." });
            query = query.Where(e => e.Type == parsedType);
        }

        var list = await query
            .OrderByDescending(e => e.ExpenseDate)
            .Select(e => new ExpenseRecordResponse(
                e.Id,
                e.VehicleId,
                e.TripId,
                e.Type,
                e.Amount,
                e.Liters,
                e.OdometerReading,
                new DateTimeOffset(DateTime.SpecifyKind(e.ExpenseDate, DateTimeKind.Utc)),
                e.Notes))
            .ToListAsync(cancellationToken);
        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "FleetManager,FinancialAnalyst")]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest req, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(req.Type) || req.Amount <= 0 ||
            (req.Liters.HasValue && req.Liters.Value < 0) ||
            (req.OdometerReading.HasValue && req.OdometerReading.Value < 0) ||
            string.IsNullOrWhiteSpace(req.Notes) && req.Notes is not null)
        {
            return BadRequest(new { message = "Expense details contain invalid values." });
        }

        var tenantId = GetTenantId();
        if (req.VehicleId.HasValue && !await _db.Vehicles.AnyAsync(
            v => v.Id == req.VehicleId.Value && v.TenantId == tenantId,
            cancellationToken))
        {
            return BadRequest(new { message = "Vehicle was not found in this workspace." });
        }
        if (req.TripId.HasValue && !await _db.Trips.AnyAsync(
            t => t.Id == req.TripId.Value && t.TenantId == tenantId,
            cancellationToken))
        {
            return BadRequest(new { message = "Trip was not found in this workspace." });
        }
        if (req.VehicleId.HasValue && req.TripId.HasValue && !await _db.Trips.AnyAsync(
            t => t.Id == req.TripId.Value && t.VehicleId == req.VehicleId.Value && t.TenantId == tenantId,
            cancellationToken))
        {
            return BadRequest(new { message = "Expense vehicle does not match the selected trip." });
        }
        if (req.Type == ExpenseType.Fuel && (!req.Liters.HasValue || req.Liters.Value <= 0))
            return BadRequest(new { message = "Fuel expenses require a positive number of liters." });

        var record = new ExpenseRecord
        {
            TenantId = tenantId,
            VehicleId = req.VehicleId,
            TripId = req.TripId,
            Type = req.Type,
            Amount = req.Amount,
            Liters = req.Liters,
            OdometerReading = req.OdometerReading,
            ExpenseDate = req.ExpenseDate?.UtcDateTime ?? DateTime.UtcNow,
            Notes = req.Notes
        };

        _db.Expenses.Add(record);
        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveExpenseUpdated(new { expenseId = record.Id });

        return CreatedAtAction(nameof(GetAll), new { id = record.Id }, ToResponse(record));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "FleetManager,FinancialAnalyst")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var record = await _db.Expenses.FirstOrDefaultAsync(
            e => e.Id == id && e.TenantId == tenantId,
            cancellationToken);
        if (record == null) return NotFound();

        _db.Expenses.Remove(record);
        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveExpenseUpdated(new { expenseId = id });
        return NoContent();
    }

    private static ExpenseRecordResponse ToResponse(ExpenseRecord record) =>
        new(
            record.Id,
            record.VehicleId,
            record.TripId,
            record.Type,
            record.Amount,
            record.Liters,
            record.OdometerReading,
            new DateTimeOffset(DateTime.SpecifyKind(record.ExpenseDate, DateTimeKind.Utc)),
            record.Notes);
}
