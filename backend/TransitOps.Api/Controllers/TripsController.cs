using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TransitOps.Api.Hubs;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TripsController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly IHubContext<TransitOpsHub, ITransitOpsClient> _hub;

    public TripsController(TransitOpsDbContext db, IHubContext<TransitOpsHub, ITransitOpsClient> hub)
    {
        _db = db;
        _hub = hub;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value ?? "demo_tenant";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? search)
    {
        var tenantId = GetTenantId();
        var query = _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .Where(t => t.TenantId == tenantId);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<TripStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(t => t.Status == parsedStatus);
        }

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            query = query.Where(t => t.TripCode.ToLower().Contains(s) || t.Source.ToLower().Contains(s) || t.Destination.ToLower().Contains(s));
        }

        var list = await query.OrderByDescending(t => t.CreatedAtUtc).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTripRequest req)
    {
        var tenantId = GetTenantId();

        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == req.VehicleId && v.TenantId == tenantId);
        if (vehicle == null)
            return BadRequest(new { message = "Selected vehicle was not found." });

        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == req.DriverId && d.TenantId == tenantId);
        if (driver == null)
            return BadRequest(new { message = "Selected driver was not found." });

        // Business Rule 1: Never Overload Cargo
        if (req.CargoWeightKg > vehicle.MaxCapacityKg)
        {
            return BadRequest(new
            {
                message = $"Cargo weight ({req.CargoWeightKg:N0} kg) exceeds vehicle max payload capacity ({vehicle.MaxCapacityKg:N0} kg)."
            });
        }

        // Business Rule 2: Ground Expired or Suspended Drivers
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (driver.Status == DriverStatus.Suspended || driver.LicenseExpiryDate < today)
        {
            return UnprocessableEntity(new
            {
                message = "Selected driver is legally grounded due to an expired commercial driving license or safety suspension."
            });
        }

        if (vehicle.Status != VehicleStatus.Available)
        {
            return BadRequest(new { message = $"Cannot assign vehicle. Asset is currently '{vehicle.Status}'." });
        }

        var tripCode = $"TRIP-{new Random().Next(1000, 9999)}";
        decimal freightRevenue = req.Revenue ?? (req.PlannedDistanceKm * 45m); // ₹45/km baseline freight rate

        var trip = new Trip
        {
            TenantId = tenantId,
            TripCode = tripCode,
            Source = req.Source,
            Destination = req.Destination,
            VehicleId = vehicle.Id,
            DriverId = driver.Id,
            CargoWeightKg = req.CargoWeightKg,
            PlannedDistanceKm = req.PlannedDistanceKm,
            Revenue = freightRevenue,
            Status = TripStatus.Draft
        };

        _db.Trips.Add(trip);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = trip.Id }, trip);
    }

    [HttpPost("{id:guid}/dispatch")]
    public async Task<IActionResult> Dispatch(Guid id)
    {
        var tenantId = GetTenantId();

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var trip = await _db.Trips
                .Include(t => t.Vehicle)
                .Include(t => t.Driver)
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId);

            if (trip == null) return NotFound();

            if (trip.Status != TripStatus.Draft)
                return BadRequest(new { message = $"Trip is already '{trip.Status}'." });

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (trip.Driver.Status == DriverStatus.Suspended || trip.Driver.LicenseExpiryDate < today)
            {
                return UnprocessableEntity(new { message = "Driver cannot be dispatched due to expired license or active suspension." });
            }

            // Atomic state machine
            trip.Status = TripStatus.Dispatched;
            trip.DispatchedAtUtc = DateTime.UtcNow;
            trip.Vehicle.Status = VehicleStatus.OnTrip;
            trip.Driver.Status = DriverStatus.OnTrip;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            // Broadcast real-time dispatch update via SignalR
            await _hub.Clients.Group($"tenant_{tenantId}").ReceiveTripDispatched(new
            {
                tripId = trip.Id,
                tripCode = trip.TripCode,
                status = "Dispatched",
                vehicle = trip.Vehicle.Name,
                driver = trip.Driver.Name
            });

            return Ok(trip);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return StatusCode(500, new { message = "Failed to dispatch trip atomically: " + ex.Message });
        }
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteTripRequest req)
    {
        var tenantId = GetTenantId();

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var trip = await _db.Trips
                .Include(t => t.Vehicle)
                .Include(t => t.Driver)
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId);

            if (trip == null) return NotFound();

            if (trip.Status != TripStatus.Dispatched)
                return BadRequest(new { message = "Only dispatched trips can be completed." });

            if (req.FinalOdometerKm <= trip.Vehicle.CurrentOdometerKm)
            {
                return BadRequest(new { message = $"Final odometer ({req.FinalOdometerKm:N0}) must be greater than previous vehicle odometer ({trip.Vehicle.CurrentOdometerKm:N0})." });
            }

            // Atomic completion
            trip.Status = TripStatus.Completed;
            trip.FinalOdometerKm = req.FinalOdometerKm;
            trip.FuelConsumedLiters = req.FuelConsumedLiters;
            trip.CompletedAtUtc = DateTime.UtcNow;

            trip.Vehicle.CurrentOdometerKm = req.FinalOdometerKm;
            trip.Vehicle.RevenueGenerated += trip.Revenue;
            trip.Vehicle.Status = VehicleStatus.Available;

            trip.Driver.Status = DriverStatus.Available;
            trip.Driver.TotalTripsCompleted += 1;

            // Automatically record fuel expense
            if (req.FuelConsumedLiters > 0)
            {
                decimal fuelCost = req.FuelConsumedLiters * 105m; // ₹105/L
                _db.Expenses.Add(new ExpenseRecord
                {
                    TenantId = tenantId,
                    VehicleId = trip.VehicleId,
                    TripId = trip.Id,
                    Type = ExpenseType.Fuel,
                    Amount = fuelCost,
                    Liters = req.FuelConsumedLiters,
                    OdometerReading = req.FinalOdometerKm,
                    Notes = $"Automated diesel turn-in log for {trip.TripCode}"
                });
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            // Broadcast real-time completion update via SignalR
            await _hub.Clients.Group($"tenant_{tenantId}").ReceiveTripCompleted(new
            {
                tripId = trip.Id,
                tripCode = trip.TripCode,
                status = "Completed",
                finalOdometer = req.FinalOdometerKm
            });

            return Ok(trip);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return StatusCode(500, new { message = "Failed to complete trip atomically: " + ex.Message });
        }
    }
}
