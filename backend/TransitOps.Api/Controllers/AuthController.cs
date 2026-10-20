using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public sealed class AuthController : ControllerBase
{
    private const string AccessCookieName = "transitops_access";
    private static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(30);
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;
    private readonly IValidator<LoginRequest> _loginValidator;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config,
        IValidator<LoginRequest> loginValidator)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
        _loginValidator = loginValidator;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var validation = await _loginValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return BadRequest(new ValidationProblemDetails(validation.ToDictionary()));
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            return InvalidCredentials();
        }

        var result = await _signInManager.CheckPasswordSignInAsync(
            user,
            request.Password,
            lockoutOnFailure: true);

        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        WriteAccessCookie(user);
        return Ok(ToUserDto(user));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId);
        return user is null ? Unauthorized() : Ok(ToUserDto(user));
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(AccessCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        });
        return NoContent();
    }

    private IActionResult InvalidCredentials() => Unauthorized(new ProblemDetails
    {
        Status = StatusCodes.Status401Unauthorized,
        Title = "Sign-in failed",
        Detail = "The email address or password is incorrect."
    });

    private UserDto ToUserDto(ApplicationUser user) => new(
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
        user.TenantId,
        user.IsDemoAccount,
        user.AvatarUrl);

    private void WriteAccessCookie(ApplicationUser user)
    {
        var token = GenerateJwtToken(user);
        Response.Cookies.Append(AccessCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.Add(AccessTokenLifetime)
        });
    }

    private string GenerateJwtToken(ApplicationUser user)
    {
        var secret = _config["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT signing key is not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.Add(AccessTokenLifetime);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("tenant_id", user.TenantId),
            new Claim("is_demo", user.IsDemoAccount.ToString()),
            new Claim("security_stamp", user.SecurityStamp ?? string.Empty)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
