using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TransitOps.Application.DTOs;
using TransitOps.Application.Validators;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Api.Hubs;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly IValidator<CreateVehicleRequest> _createValidator;
    private readonly ILogger<VehiclesController> _logger;
    private readonly IHubContext<TransitOpsHub, ITransitOpsClient> _hub;

    public VehiclesController(
        TransitOpsDbContext db,
        IValidator<CreateVehicleRequest> createValidator,
        ILogger<VehiclesController> logger,
        IHubContext<TransitOpsHub, ITransitOpsClient> hub)
    {
        _db = db;
        _createValidator = createValidator;
        _logger = logger;
        _hub = hub;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    [HttpGet]
    [Authorize(Roles = "FleetManager,Driver,SafetyOfficer,FinancialAnalyst")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? region,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var query = _db.Vehicles
            .Include(v => v.Documents)
            .Where(v => v.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<VehicleStatus>(status, true, out var parsedStatus) ||
                !Enum.IsDefined(parsedStatus))
            {
                return BadRequest(new { message = "Invalid vehicle status filter." });
            }
            query = query.Where(v => v.Status == parsedStatus);
        }

        if (!string.IsNullOrEmpty(region) && region != "All")
        {
            query = query.Where(v => v.Region == region);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(v => v.Name.ToLower().Contains(s) ||
                v.RegistrationNumber.ToLower().Contains(s) || v.Model.ToLower().Contains(s));
        }

        var list = await query.OrderByDescending(v => v.CreatedAtUtc).ToListAsync(cancellationToken);
        return Ok(list.Select(ToResponse));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "FleetManager,Driver,SafetyOfficer,FinancialAnalyst")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles
            .Include(v => v.Documents)
            .FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId, cancellationToken);

        if (vehicle == null) return NotFound();
        return Ok(ToResponse(vehicle));
    }

    [HttpPost]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Create([FromBody] CreateVehicleRequest req, CancellationToken cancellationToken)
    {
        var validation = await _createValidator.ValidateAsync(req, cancellationToken);
        if (!validation.IsValid)
        {
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));
        }

        var tenantId = GetTenantId();
        IndianRegulatoryFormats.TryNormalizeRegistration(req.RegistrationNumber, out var registrationNumber, out _);
        var compactRegistration = IndianRegulatoryFormats.CompactForComparison(registrationNumber);

        var exists = await _db.Vehicles.AnyAsync(
            v => v.TenantId == tenantId &&
                v.RegistrationNumber.ToUpper().Replace("-", "").Replace(" ", "") == compactRegistration,
            cancellationToken);
        if (exists)
        {
            return Conflict(new { message = $"A vehicle with registration number '{registrationNumber}' already exists." });
        }

        var vehicle = new Vehicle
        {
            TenantId = tenantId,
            RegistrationNumber = registrationNumber,
            Name = req.Name.Trim(),
            Model = req.Model.Trim(),
            Type = req.Type,
            MaxCapacityKg = req.MaxCapacityKg,
            CurrentOdometerKm = req.CurrentOdometerKm,
            AcquisitionCost = req.AcquisitionCost,
            Status = VehicleStatus.Available,
            Region = req.Region.Trim(),
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
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            _logger.LogInformation(ex, "Duplicate vehicle registration rejected.");
            return Conflict(new { message = "A vehicle with this registration number already exists." });
        }

        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveVehicleStatusChanged(vehicle.Id.ToString(), vehicle.Status.ToString());
        return CreatedAtAction(nameof(GetById), new { id = vehicle.Id }, ToResponse(vehicle));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateVehicleRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(
            v => v.Id == id && v.TenantId == tenantId,
            cancellationToken);
        if (vehicle is null) return NotFound();

        if (request.RegistrationNumber is not null)
        {
            if (!IndianRegulatoryFormats.TryNormalizeRegistration(request.RegistrationNumber, out var registrationNumber, out var registrationError))
                return BadRequest(new { message = registrationError });
            var compactRegistration = IndianRegulatoryFormats.CompactForComparison(registrationNumber);
            if (await _db.Vehicles.AnyAsync(
                v => v.Id != id && v.TenantId == tenantId &&
                    v.RegistrationNumber.ToUpper().Replace("-", "").Replace(" ", "") == compactRegistration,
                cancellationToken))
                return Conflict(new { message = "A vehicle with this registration number already exists." });
            vehicle.RegistrationNumber = registrationNumber;
        }
        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Vehicle name cannot be empty." });
            vehicle.Name = request.Name.Trim();
        }
        if (request.Model is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Model))
                return BadRequest(new { message = "Vehicle model cannot be empty." });
            vehicle.Model = request.Model.Trim();
        }
        if (request.Type.HasValue)
        {
            if (!Enum.IsDefined(request.Type.Value))
                return BadRequest(new { message = "Invalid vehicle type." });
            vehicle.Type = request.Type.Value;
        }
        if (request.MaxCapacityKg.HasValue)
        {
            if (request.MaxCapacityKg.Value <= 0)
                return BadRequest(new { message = "Maximum load capacity must be greater than zero." });
            vehicle.MaxCapacityKg = request.MaxCapacityKg.Value;
        }
        if (request.CurrentOdometerKm.HasValue)
        {
            if (request.CurrentOdometerKm.Value < vehicle.CurrentOdometerKm)
                return BadRequest(new { message = "Odometer cannot be reduced." });
            vehicle.CurrentOdometerKm = request.CurrentOdometerKm.Value;
        }
        if (request.AcquisitionCost.HasValue)
        {
            if (request.AcquisitionCost.Value < 0)
                return BadRequest(new { message = "Acquisition cost cannot be negative." });
            vehicle.AcquisitionCost = request.AcquisitionCost.Value;
        }
        if (request.Status.HasValue)
            return BadRequest(new { message = "Use the dedicated lifecycle operation to change vehicle status." });
        if (request.Region is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Region))
                return BadRequest(new { message = "Region cannot be empty." });
            vehicle.Region = request.Region.Trim();
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            _logger.LogInformation(ex, "Concurrent duplicate vehicle registration rejected.");
            return Conflict(new { message = "A vehicle with this registration number already exists." });
        }
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveVehicleStatusChanged(vehicle.Id.ToString(), vehicle.Status.ToString());
        return Ok(ToResponse(vehicle));
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateVehicleStatusDto req,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(
            v => v.Id == id && v.TenantId == tenantId,
            cancellationToken);
        if (vehicle == null) return NotFound();

        if (!Enum.TryParse<VehicleStatus>(req.Status, true, out var newStatus) ||
            !Enum.IsDefined(newStatus) ||
            newStatus != VehicleStatus.Available)
        {
            return BadRequest(new { message = "Only an eligible vehicle can be returned to Available through this operation." });
        }

        var hasActiveTrip = await _db.Trips.AnyAsync(
            t => t.VehicleId == id && t.TenantId == tenantId && t.Status == TripStatus.Dispatched,
            cancellationToken);
        var hasActiveMaintenance = await _db.MaintenanceRecords.AnyAsync(
            m => m.VehicleId == id && m.TenantId == tenantId && m.Status == MaintenanceStatus.Active,
            cancellationToken);
        if (hasActiveTrip || hasActiveMaintenance || vehicle.Status == VehicleStatus.Retired)
            return Conflict(new { message = "Vehicle cannot be marked Available while retired, on an active trip, or under maintenance." });

        vehicle.Status = VehicleStatus.Available;
        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveVehicleStatusChanged(vehicle.Id.ToString(), vehicle.Status.ToString());
        return Ok(ToResponse(vehicle));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Retire(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(
            v => v.Id == id && v.TenantId == tenantId,
            cancellationToken);
        if (vehicle == null) return NotFound();

        var hasActiveTrip = await _db.Trips.AnyAsync(
            t => t.VehicleId == id && t.TenantId == tenantId && t.Status == TripStatus.Dispatched,
            cancellationToken);
        var hasActiveMaintenance = await _db.MaintenanceRecords.AnyAsync(
            m => m.VehicleId == id && m.TenantId == tenantId && m.Status == MaintenanceStatus.Active,
            cancellationToken);
        if (hasActiveTrip || hasActiveMaintenance)
            return Conflict(new { message = "A vehicle with an active trip or maintenance record cannot be retired." });

        vehicle.Status = VehicleStatus.Retired;
        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveVehicleStatusChanged(vehicle.Id.ToString(), vehicle.Status.ToString());
        return Ok(new { message = "Vehicle retired safely." });
    }

    private VehicleResponse ToResponse(Vehicle vehicle)
    {
        var canViewFinancials = User.IsInRole("FleetManager") || User.IsInRole("FinancialAnalyst");
        return new VehicleResponse(
            vehicle.Id,
            vehicle.RegistrationNumber,
            vehicle.Name,
            vehicle.Model,
            vehicle.Type,
            vehicle.MaxCapacityKg,
            vehicle.CurrentOdometerKm,
            canViewFinancials ? vehicle.AcquisitionCost : null,
            vehicle.Status,
            vehicle.Region,
            canViewFinancials ? vehicle.RevenueGenerated : null,
            vehicle.FuelEfficiencyKmPerLiter,
            vehicle.Documents.Select(document => new VehicleDocumentResponse(
                document.Type,
                new DateTimeOffset(DateTime.SpecifyKind(document.ExpiryDate, DateTimeKind.Utc)),
                document.Status)).ToArray(),
            new DateTimeOffset(DateTime.SpecifyKind(vehicle.CreatedAtUtc, DateTimeKind.Utc)));
    }
}
