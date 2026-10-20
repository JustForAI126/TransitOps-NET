using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransitOps.Application.DTOs;
using TransitOps.Application.Validators;
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
    private readonly IValidator<UpdateOrganizationUserRequest> _updateValidator;

    public OrganizationUsersController(
        TransitOpsDbContext db,
        UserManager<ApplicationUser> userManager,
        IValidator<CreateOrganizationUserRequest> validator,
        IValidator<UpdateOrganizationUserRequest> updateValidator)
    {
        _db = db;
        _userManager = userManager;
        _validator = validator;
        _updateValidator = updateValidator;
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
        var drivers = await _db.Drivers
            .AsNoTracking()
            .Where(driver => driver.TenantId == tenantId && driver.IdentityUserId != null &&
                             userIds.Contains(driver.IdentityUserId))
            .ToDictionaryAsync(driver => driver.IdentityUserId!, cancellationToken);

        return Ok(users.Select(user => ToResponse(
            user,
            drivers.GetValueOrDefault(user.Id))).ToArray());
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

        var driver = await _db.Drivers
            .AsNoTracking()
            .Where(driver => driver.TenantId == user.TenantId && driver.IdentityUserId == user.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return Ok(ToResponse(user, driver));
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

        Driver? createdDriver = null;
        if (request.Role == UserRole.Driver)
        {
            createdDriver = new Driver
            {
                TenantId = tenantId,
                IdentityUserId = user.Id,
                Name = request.FullName.Trim(),
                Email = email,
                ContactNumber = request.ContactNumber!.Trim(),
                LicenseNumber = NormalizeLicence(request.LicenseNumber),
                LicenseCategory = IndianRules.NormalizeClasses(request.LicenseCategory!),
                LicenseExpiryDate = request.LicenseExpiryDate!.Value,
                SafetyScore = 100,
                Status = DriverStatus.Available
            };
            _db.Drivers.Add(createdDriver);
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
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
        var response = ToResponse(user, createdDriver);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, response);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(OrganizationUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        string id,
        [FromBody] UpdateOrganizationUserRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await _updateValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));

        var user = await _db.Users.FirstOrDefaultAsync(
            candidate => candidate.Id == id && candidate.TenantId == GetTenantId(),
            cancellationToken);
        if (user is null)
            return NotFound();

        if (user.Role == UserRole.OrganizationAdmin)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Administrator account is protected",
                Detail = "Organization administrator accounts cannot be changed from this screen."
            });
        }

        if (request.Role == UserRole.OrganizationAdmin)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Role cannot be assigned",
                Detail = "Organization administrator access can only be provisioned through the trusted organization setup process."
            });
        }

        var email = request.Email.Trim();
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser is not null && existingUser.Id != user.Id)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Email already in use",
                Detail = "An account with this email address already exists."
            });
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var driver = await _db.Drivers.FirstOrDefaultAsync(
            candidate => candidate.TenantId == user.TenantId && candidate.IdentityUserId == user.Id,
            cancellationToken);
        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.UserName = email;
        user.Role = request.Role;

        if (request.Role == UserRole.Driver)
        {
            driver ??= new Driver
            {
                TenantId = user.TenantId,
                IdentityUserId = user.Id,
                SafetyScore = 100,
                Status = DriverStatus.Available
            };
            driver.IdentityUserId = user.Id;
            driver.Name = user.FullName;
            driver.Email = email;
            driver.ContactNumber = request.ContactNumber!.Trim();
            driver.LicenseNumber = NormalizeLicence(request.LicenseNumber);
            driver.LicenseCategory = IndianRules.NormalizeClasses(request.LicenseCategory!);
            driver.LicenseExpiryDate = request.LicenseExpiryDate!.Value;
            if (_db.Entry(driver).State == EntityState.Detached)
                _db.Drivers.Add(driver);
        }
        else if (driver is not null)
        {
            driver.Name = user.FullName;
            driver.Email = email;
        }

        try
        {
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                await transaction.RollbackAsync(cancellationToken);
                return IdentityFailure(updateResult);
            }

            var stampResult = await _userManager.UpdateSecurityStampAsync(user);
            if (!stampResult.Succeeded)
            {
                await transaction.RollbackAsync(cancellationToken);
                return IdentityFailure(stampResult);
            }

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Organization account could not be updated",
                Detail = "The email address or driver license details may already be in use."
            });
        }

        return Ok(ToResponse(user, driver));
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(
            candidate => candidate.Id == id && candidate.TenantId == GetTenantId(),
            cancellationToken);
        if (user is null)
            return NotFound();

        if (user.Role == UserRole.OrganizationAdmin)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Administrator account is protected",
                Detail = "Organization administrator accounts cannot be deleted from this screen."
            });
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var driver = await _db.Drivers.FirstOrDefaultAsync(
                candidate => candidate.TenantId == user.TenantId && candidate.IdentityUserId == user.Id,
                cancellationToken);
            if (driver is not null)
            {
                driver.IdentityUserId = null;
                await _db.SaveChangesAsync(cancellationToken);
            }

            var deleteResult = await _userManager.DeleteAsync(user);
            if (!deleteResult.Succeeded)
            {
                await transaction.RollbackAsync(cancellationToken);
                return IdentityFailure(deleteResult);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Organization account could not be deleted",
                Detail = "The account is still referenced by data that must be retained."
            });
        }

        return NoContent();
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    private static IActionResult IdentityFailure(IdentityResult result)
    {
        var errors = result.Errors.ToDictionary(
            error => error.Code,
            error => new[] { error.Description });
        var status = result.Errors.Any(error =>
            error.Code is "DuplicateEmail" or "DuplicateUserName")
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest;
        var details = new ValidationProblemDetails(errors)
        {
            Status = status,
            Title = status == StatusCodes.Status409Conflict
                ? "Organization account already exists"
                : "Organization account could not be updated"
        };
        return new ObjectResult(details) { StatusCode = status };
    }

    private static OrganizationUserResponse ToResponse(ApplicationUser user, Driver? driver) => new(
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
        driver?.Id,
        driver?.ContactNumber,
        driver?.LicenseNumber,
        driver?.LicenseCategory,
        driver?.LicenseExpiryDate);

    // The request validator has already rejected numbers that do not follow the Indian format.
    private static string NormalizeLicence(string? value) =>
        IndianRegulatoryFormats.TryNormalizeLicence(value, out var normalized, out _)
            ? normalized
            : value!.Trim().ToUpperInvariant();
}
