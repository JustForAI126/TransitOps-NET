using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "OrganizationAdmin")]
public sealed class OrganizationUsersController : ControllerBase
{
    private readonly TransitOpsDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IValidator<CreateOrganizationUserRequest> _validator;

    public OrganizationUsersController(
        TransitOpsDbContext db,
        UserManager<ApplicationUser> userManager,
        IValidator<CreateOrganizationUserRequest> validator)
    {
        _db = db;
        _userManager = userManager;
        _validator = validator;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrganizationUserResponse>>> GetAll(
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var users = await _db.Users
            .AsNoTracking()
            .Where(user => user.TenantId == tenantId)
            .OrderBy(user => user.Email)
            .ToListAsync(cancellationToken);
        var userIds = users.Select(user => user.Id).ToArray();
        var driverIds = await _db.Drivers
            .AsNoTracking()
            .Where(driver => driver.TenantId == tenantId && driver.IdentityUserId != null &&
                             userIds.Contains(driver.IdentityUserId))
            .ToDictionaryAsync(driver => driver.IdentityUserId!, driver => (Guid?)driver.Id, cancellationToken);

        return Ok(users.Select(user => ToResponse(
            user,
            driverIds.GetValueOrDefault(user.Id))).ToArray());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OrganizationUserResponse>> GetById(
        string id,
        CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                candidate => candidate.Id == id && candidate.TenantId == GetTenantId(),
                cancellationToken);
        if (user is null)
            return NotFound();

        var driverId = await _db.Drivers
            .Where(driver => driver.TenantId == user.TenantId && driver.IdentityUserId == user.Id)
            .Select(driver => (Guid?)driver.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return Ok(ToResponse(user, driverId));
    }

    [HttpPost]
    public async Task<ActionResult<OrganizationUserResponse>> Create(
        [FromBody] CreateOrganizationUserRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await _validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));

        var email = request.Email.Trim();
        var tenantId = GetTenantId();
        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Account already exists",
                Detail = "An account with this email address already exists."
            });
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = request.FullName.Trim(),
            Role = request.Role,
            TenantId = tenantId,
            EmailConfirmed = true,
            LockoutEnabled = true
        };
        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            if (createResult.Errors.Any(error =>
                    error.Code is "DuplicateEmail" or "DuplicateUserName"))
            {
                return Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Account already exists",
                    Detail = "An account with this email address already exists."
                });
            }

            var errors = createResult.Errors.ToDictionary(
                error => error.Code.StartsWith("Password", StringComparison.Ordinal)
                    ? nameof(request.Password)
                    : nameof(request.Email),
                error => new[] { error.Code.StartsWith("Password", StringComparison.Ordinal)
                    ? "Password does not meet the account security requirements."
                    : "Unable to create an account with these details." });
            return BadRequest(new ValidationProblemDetails(errors));
        }

        Guid? driverId = null;
        if (request.Role == UserRole.Driver)
        {
            var driver = new Driver
            {
                TenantId = tenantId,
                IdentityUserId = user.Id,
                Name = request.FullName.Trim(),
                Email = email,
                ContactNumber = request.ContactNumber!.Trim(),
                LicenseNumber = request.LicenseNumber!.Trim().ToUpperInvariant(),
                LicenseCategory = request.LicenseCategory!.Trim(),
                LicenseExpiryDate = request.LicenseExpiryDate!.Value,
                SafetyScore = 100,
                Status = DriverStatus.Available
            };
            _db.Drivers.Add(driver);
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                driverId = driver.Id;
            }
            catch (DbUpdateException)
            {
                await transaction.RollbackAsync(cancellationToken);
                return Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Driver profile already exists",
                    Detail = "The supplied email or license number is already assigned to a driver."
                });
            }
        }

        await transaction.CommitAsync(cancellationToken);
        var response = ToResponse(user, driverId);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, response);
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    private static OrganizationUserResponse ToResponse(ApplicationUser user, Guid? driverId) => new(
        user.Id,
        user.FullName,
        user.Email ?? string.Empty,
        user.Role switch
        {
            UserRole.OrganizationAdmin => "organization_admin",
            UserRole.FleetManager => "fleet_manager",
            UserRole.Driver => "driver",
            UserRole.SafetyOfficer => "safety_officer",
            UserRole.FinancialAnalyst => "financial_analyst",
            _ => throw new InvalidOperationException("The account has an unsupported role.")
        },
        driverId);
}
