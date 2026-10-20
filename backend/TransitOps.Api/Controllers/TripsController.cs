using System.Data;
using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
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
[Authorize]
public class TripsController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly IHubContext<TransitOpsHub, ITransitOpsClient> _hub;
    private readonly IValidator<CreateTripRequest> _createValidator;
    private readonly IValidator<CompleteTripRequest> _completeValidator;

    public TripsController(
        TransitOpsDbContext db,
        IHubContext<TransitOpsHub, ITransitOpsClient> hub,
        IValidator<CreateTripRequest> createValidator,
        IValidator<CompleteTripRequest> completeValidator)
    {
        _db = db;
        _hub = hub;
        _createValidator = createValidator;
        _completeValidator = completeValidator;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    private string? GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
        User.FindFirst("sub")?.Value;

    [HttpGet]
    [Authorize(Roles = "FleetManager,Driver,FinancialAnalyst")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var query = _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .Where(t => t.TenantId == tenantId);

        if (User.IsInRole(UserRole.Driver.ToString()))
        {
            var userId = GetUserId();
            if (userId is null)
                return Ok(Array.Empty<TripResponse>());

            query = query.Where(trip => trip.Driver.IdentityUserId == userId);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<TripStatus>(status, true, out var parsedStatus) ||
                !Enum.IsDefined(parsedStatus))
            {
                return BadRequest(new { message = "Invalid trip status filter." });
            }
            query = query.Where(t => t.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(t => t.TripCode.ToLower().Contains(s) || t.Source.ToLower().Contains(s) || t.Destination.ToLower().Contains(s));
        }

        var list = await query.OrderByDescending(t => t.CreatedAtUtc).ToListAsync(cancellationToken);
        var canViewFinancials = User.IsInRole("FleetManager") || User.IsInRole("FinancialAnalyst");
        return Ok(list.Select(trip => ToResponse(trip, canViewFinancials)));
    }

    [HttpPost]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Create([FromBody] CreateTripRequest req, CancellationToken cancellationToken)
    {
        var validation = await _createValidator.ValidateAsync(req, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));
        if (req.Revenue.HasValue && req.Revenue.Value < 0)
            return BadRequest(new { message = "Revenue cannot be negative." });

        var tenantId = GetTenantId();

        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(
            v => v.Id == req.VehicleId && v.TenantId == tenantId,
            cancellationToken);
        if (vehicle == null)
            return BadRequest(new { message = "Selected vehicle was not found." });

        var driver = await _db.Drivers.FirstOrDefaultAsync(
            d => d.Id == req.DriverId && d.TenantId == tenantId,
            cancellationToken);
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
        if (driver.Status is DriverStatus.Suspended or DriverStatus.OffDuty or DriverStatus.OnTrip ||
            driver.LicenseExpiryDate < today)
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

        var tripCode = $"TRIP-{Guid.NewGuid():N}".ToUpperInvariant();
        decimal freightRevenue = req.Revenue ?? 0m;

        var trip = new Trip
        {
            TenantId = tenantId,
            TripCode = tripCode,
            Source = req.Source,
            Destination = req.Destination,
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            DriverId = driver.Id,
            Driver = driver,
            CargoWeightKg = req.CargoWeightKg,
            PlannedDistanceKm = req.PlannedDistanceKm,
            Revenue = freightRevenue,
            Status = TripStatus.Draft
        };

        _db.Trips.Add(trip);
        await _db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetAll),
            new { id = trip.Id },
            ToResponse(trip, canViewFinancials: false));
    }

    [HttpPost("{id:guid}/dispatch")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Dispatch(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();

        await using var tx = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
            var trip = await _db.Trips
                .Include(t => t.Vehicle)
                .Include(t => t.Driver)
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, cancellationToken);

            if (trip == null) return NotFound();

            if (trip.Status != TripStatus.Draft)
                return BadRequest(new { message = $"Trip is already '{trip.Status}'." });

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (trip.Driver.Status is DriverStatus.Suspended or DriverStatus.OffDuty or DriverStatus.OnTrip ||
                trip.Driver.LicenseExpiryDate < today)
            {
                return UnprocessableEntity(new { message = "Driver cannot be dispatched due to expired license or active suspension." });
            }

            if (trip.Vehicle.Status != VehicleStatus.Available)
                return Conflict(new { message = $"Vehicle is not available for dispatch ({trip.Vehicle.Status})." });
            if (trip.CargoWeightKg <= 0 || trip.CargoWeightKg > trip.Vehicle.MaxCapacityKg)
                return UnprocessableEntity(new { message = "Trip cargo exceeds vehicle capacity." });

            trip.Status = TripStatus.Dispatched;
            trip.DispatchedAtUtc = DateTime.UtcNow;
            trip.Vehicle.Status = VehicleStatus.OnTrip;
            trip.Driver.Status = DriverStatus.OnTrip;

            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            await _hub.Clients.Group($"tenant_{tenantId}").ReceiveTripDispatched(new
            {
                tripId = trip.Id,
                tripCode = trip.TripCode,
                status = "Dispatched",
                vehicle = trip.Vehicle.Name,
                driver = trip.Driver.Name
            });

            return Ok(ToResponse(trip, canViewFinancials: User.IsInRole("FleetManager")));
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Roles = "FleetManager,Driver")]
    public async Task<IActionResult> Complete(
        Guid id,
        [FromBody] CompleteTripRequest req,
        CancellationToken cancellationToken)
    {
        var validation = await _completeValidator.ValidateAsync(req, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));

        var tenantId = GetTenantId();

        await using var tx = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
            var trip = await _db.Trips
                .Include(t => t.Vehicle)
                .Include(t => t.Driver)
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, cancellationToken);

            if (trip == null) return NotFound();

            if (User.IsInRole(UserRole.Driver.ToString()) &&
                !string.Equals(trip.Driver.IdentityUserId, GetUserId(), StringComparison.Ordinal))
            {
                return Forbid();
            }

            if (trip.Status != TripStatus.Dispatched)
                return BadRequest(new { message = "Only dispatched trips can be completed." });

            if (req.FinalOdometerKm <= trip.Vehicle.CurrentOdometerKm)
            {
                return BadRequest(new { message = $"Final odometer ({req.FinalOdometerKm:N0}) must be greater than previous vehicle odometer ({trip.Vehicle.CurrentOdometerKm:N0})." });
            }

            trip.Status = TripStatus.Completed;
            trip.FinalOdometerKm = req.FinalOdometerKm;
            trip.FuelConsumedLiters = req.FuelConsumedLiters;
            trip.CompletedAtUtc = DateTime.UtcNow;

            trip.Vehicle.CurrentOdometerKm = req.FinalOdometerKm;
            trip.Vehicle.RevenueGenerated += trip.Revenue;
            trip.Vehicle.Status = VehicleStatus.Available;

            trip.Driver.Status = DriverStatus.Available;
            trip.Driver.TotalTripsCompleted += 1;

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

            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            await _hub.Clients.Group($"tenant_{tenantId}").ReceiveTripCompleted(new
            {
                tripId = trip.Id,
                tripCode = trip.TripCode,
                status = "Completed",
                finalOdometer = req.FinalOdometerKm
            });

            return Ok(ToResponse(trip, canViewFinancials: User.IsInRole("FleetManager")));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        await using var tx = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var trip = await _db.Trips
            .Include(t => t.Vehicle)
            .Include(t => t.Driver)
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, cancellationToken);
        if (trip is null) return NotFound();
        if (trip.Status is TripStatus.Completed or TripStatus.Cancelled)
            return Conflict(new { message = $"A {trip.Status} trip cannot be cancelled." });

        if (trip.Status == TripStatus.Dispatched)
        {
            var activeMaintenance = await _db.MaintenanceRecords.AnyAsync(
                m => m.VehicleId == trip.VehicleId &&
                    m.TenantId == tenantId &&
                    m.Status == MaintenanceStatus.Active,
                cancellationToken);
            trip.Vehicle.Status = activeMaintenance ? VehicleStatus.InShop : VehicleStatus.Available;
            trip.Driver.Status = DriverStatus.Available;
        }

        trip.Status = TripStatus.Cancelled;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return Ok(ToResponse(trip, canViewFinancials: User.IsInRole("FleetManager")));
    }

    private static TripResponse ToResponse(Trip trip, bool canViewFinancials) => new(
        trip.Id,
        trip.TripCode,
        trip.Source,
        trip.Destination,
        trip.VehicleId,
        trip.Vehicle?.RegistrationNumber ?? string.Empty,
        trip.Vehicle?.Name ?? string.Empty,
        trip.DriverId,
        trip.Driver?.Name ?? string.Empty,
        trip.CargoWeightKg,
        trip.PlannedDistanceKm,
        trip.FinalOdometerKm,
        trip.FuelConsumedLiters,
        canViewFinancials ? trip.Revenue : null,
        trip.Status,
        new DateTimeOffset(DateTime.SpecifyKind(trip.CreatedAtUtc, DateTimeKind.Utc)),
        trip.DispatchedAtUtc.HasValue
            ? new DateTimeOffset(DateTime.SpecifyKind(trip.DispatchedAtUtc.Value, DateTimeKind.Utc))
            : null,
        trip.CompletedAtUtc.HasValue
            ? new DateTimeOffset(DateTime.SpecifyKind(trip.CompletedAtUtc.Value, DateTimeKind.Utc))
            : null);
}
