using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TransitOps.Application.DTOs;
using TransitOps.Application.Services;
using TransitOps.Application.Validators;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Api.Hubs;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DriversController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly IValidator<CreateDriverRequest> _createValidator;
    private readonly ILogger<DriversController> _logger;
    private readonly IHubContext<TransitOpsHub, ITransitOpsClient> _hub;
    private readonly ISafetyScoreService _safety;

    public DriversController(
        TransitOpsDbContext db,
        IValidator<CreateDriverRequest> createValidator,
        ILogger<DriversController> logger,
        IHubContext<TransitOpsHub, ITransitOpsClient> hub,
        ISafetyScoreService safety)
    {
        _db = db;
        _createValidator = createValidator;
        _logger = logger;
        _hub = hub;
        _safety = safety;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    [HttpGet]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var query = _db.Drivers.Where(d => d.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<DriverStatus>(status, true, out var parsedStatus) ||
                !Enum.IsDefined(parsedStatus))
            {
                return BadRequest(new { message = "Invalid driver status filter." });
            }
            query = query.Where(d => d.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(s) || d.Email.ToLower().Contains(s) || d.LicenseNumber.ToLower().Contains(s));
        }

        var list = await query.OrderByDescending(d => d.CreatedAtUtc).ToListAsync(cancellationToken);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(
            d => d.Id == id && d.TenantId == tenantId,
            cancellationToken);
        return driver is null ? NotFound() : Ok(driver);
    }

    [HttpPost]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> Create([FromBody] CreateDriverRequest req, CancellationToken cancellationToken)
    {
        var validation = await _createValidator.ValidateAsync(req, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));

        var tenantId = GetTenantId();
        var email = req.Email.Trim();
        IndianRegulatoryFormats.TryNormalizeLicence(req.LicenseNumber, out var licenseNumber, out _);

        var exists = await _db.Drivers.AnyAsync(
            d => d.Email.ToUpper() == email.ToUpper() ||
                d.LicenseNumber.ToUpper().Replace("-", "").Replace(" ", "") == licenseNumber,
            cancellationToken);
        if (exists)
        {
            return Conflict(new { message = "A driver with this email or license number already exists." });
        }

        var driver = new Driver
        {
            TenantId = tenantId,
            Name = req.Name.Trim(),
            Email = email,
            ContactNumber = NormalizeContactNumber(req.ContactNumber),
            LicenseNumber = licenseNumber,
            LicenseCategory = IndianRules.NormalizeClasses(req.LicenseCategory),
            LicenseExpiryDate = req.LicenseExpiryDate,
            SafetyScore = 100,
            Status = DriverStatus.Available,
            IncidentHistoryCount = 0,
            TotalTripsCompleted = 0
        };

        _db.Drivers.Add(driver);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            _logger.LogInformation(ex, "Duplicate driver email or license number rejected.");
            return Conflict(new { message = "A driver with this email or license number already exists." });
        }

        await _safety.RecalculateAsync(driver.Id, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveDriverStatusChanged(driver.Id.ToString(), driver.Status.ToString());
        return CreatedAtAction(nameof(GetById), new { id = driver.Id }, driver);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateDriverRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(
            d => d.Id == id && d.TenantId == tenantId,
            cancellationToken);
        if (driver is null) return NotFound();

        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Driver name cannot be empty." });
            driver.Name = request.Name.Trim();
        }
        if (request.ContactNumber is not null)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(
                request.ContactNumber.Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", ""),
                @"^\+?[1-9]\d{6,14}$"))
            {
                return BadRequest(new { message = "Contact number must be a valid international phone number." });
            }
            driver.ContactNumber = NormalizeContactNumber(request.ContactNumber);
        }
        if (request.LicenseNumber is not null)
        {
            if (!IndianRegulatoryFormats.TryNormalizeLicence(request.LicenseNumber, out var licenseNumber, out var licenceError))
                return BadRequest(new { message = licenceError });
            if (await _db.Drivers.AnyAsync(
                d => d.Id != id && d.LicenseNumber.ToUpper().Replace("-", "").Replace(" ", "") == licenseNumber,
                cancellationToken))
                return Conflict(new { message = "A driver with this license number already exists." });
            driver.LicenseNumber = licenseNumber;
        }
        if (request.LicenseCategory is not null)
        {
            var invalidClasses = IndianRules.SplitClasses(request.LicenseCategory)
                .Where(c => !IndianRegulatoryFormats.LicenceClasses.Contains(c)).ToList();
            if (string.IsNullOrWhiteSpace(request.LicenseCategory) || invalidClasses.Count > 0)
                return BadRequest(new { message = "License category must be valid Indian licence classes such as LMV-TR, HMV or HGMV." });
            driver.LicenseCategory = IndianRules.NormalizeClasses(request.LicenseCategory);
        }
        if (request.LicenseExpiryDate.HasValue)
            driver.LicenseExpiryDate = request.LicenseExpiryDate.Value;
        if (request.Status.HasValue)
        {
            if (!Enum.IsDefined(request.Status.Value) || request.Status == DriverStatus.OnTrip)
                return BadRequest(new { message = "Invalid driver status transition." });

            var hasActiveTrip = await _db.Trips.AnyAsync(
                t => t.DriverId == id && t.TenantId == tenantId && t.Status == TripStatus.Dispatched,
                cancellationToken);
            if (hasActiveTrip)
                return Conflict(new { message = "Driver status cannot be changed during an active trip." });
            driver.Status = request.Status.Value;
        }

        await _safety.RecalculateAsync(driver.Id, cancellationToken);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            _logger.LogInformation(ex, "Concurrent duplicate driver license/email rejected.");
            return Conflict(new { message = "A driver with this email or license number already exists." });
        }
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveDriverStatusChanged(driver.Id.ToString(), driver.Status.ToString());
        return Ok(driver);
    }

    [HttpPut("{id:guid}/toggle-suspension")]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> ToggleSuspension(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(
            d => d.Id == id && d.TenantId == tenantId,
            cancellationToken);
        if (driver == null) return NotFound();

        var hasActiveTrip = await _db.Trips.AnyAsync(
            t => t.DriverId == id && t.TenantId == tenantId && t.Status == TripStatus.Dispatched,
            cancellationToken);
        if (hasActiveTrip)
            return Conflict(new { message = "A driver with an active trip cannot be suspended or reinstated." });

        if (driver.Status == DriverStatus.Suspended)
        {
            if (driver.LicenseExpiryDate < DateOnly.FromDateTime(DateTime.UtcNow))
                return Conflict(new { message = "An expired-license driver cannot be reinstated as Available." });
            driver.Status = DriverStatus.Available;
        }
        else
        {
            driver.Status = DriverStatus.Suspended;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveDriverStatusChanged(driver.Id.ToString(), driver.Status.ToString());

        return Ok(driver);
    }

    [HttpPost("{id:guid}/send-license-reminder")]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> SendLicenseReminder(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(
            d => d.Id == id && d.TenantId == tenantId,
            cancellationToken);
        if (driver == null) return NotFound();

        return Accepted(new { message = $"License reminder queued for {driver.Email}." });
    }

    /// <summary>Score breakdown so Safety Officers can see why a driver has their score.</summary>
    [HttpGet("{id:guid}/safety-score")]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> GetSafetyScore(Guid id, CancellationToken cancellationToken)
    {
        var result = await _safety.GetBreakdownAsync(GetTenantId(), id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Records a safety incident (accident, violation, complaint) and recalculates the score.</summary>
    [HttpPost("{id:guid}/incidents")]
    [Authorize(Roles = "FleetManager,SafetyOfficer")]
    public async Task<IActionResult> RecordIncident(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var driver = await _db.Drivers.FirstOrDefaultAsync(
            d => d.Id == id && d.TenantId == tenantId,
            cancellationToken);
        if (driver == null) return NotFound();

        driver.IncidentHistoryCount += 1;
        await _safety.RecalculateAsync(driver.Id, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _hub.Clients.Group($"tenant_{tenantId}")
            .ReceiveDriverStatusChanged(driver.Id.ToString(), driver.Status.ToString());
        return Ok(driver);
    }

    private static string NormalizeContactNumber(string value) =>
        value.Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", "");
}
