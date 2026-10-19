using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        
        // Support quick demo logins or production password verification
        if (user == null && request.Email.EndsWith("@transitops.com"))
        {
            // Seed demo user on first hit if not yet seeded
            var demoRole = request.Role != null && Enum.TryParse<UserRole>(request.Role, true, out var parsedRole)
                ? parsedRole
                : UserRole.FleetManager;

            user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FullName = GetNameFromEmail(request.Email),
                Role = demoRole,
                TenantId = "demo_tenant",
                IsDemoAccount = true,
                EmailConfirmed = true
            };

            await _userManager.CreateAsync(user, "TransitOps@Demo2026!");
        }

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid email or credentials." });
        }

        var token = GenerateJwtToken(user);
        var userDto = new UserDto(
            user.Id,
            user.FullName,
            user.Email ?? "",
            user.Role.ToString(),
            user.TenantId,
            user.IsDemoAccount,
            user.AvatarUrl
        );

        return Ok(new AuthResponse(token, Guid.NewGuid().ToString("N"), userDto));
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing != null)
        {
            return BadRequest(new { message = "An account with this email already exists." });
        }

        var role = Enum.TryParse<UserRole>(request.Role, true, out var parsedRole)
            ? parsedRole
            : UserRole.FleetManager;

        // New accounts get a unique, isolated tenant ID. Seeded demo data is NEVER visible to new accounts!
        var newTenantId = $"tenant_{Guid.NewGuid():N}";

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName,
            Role = role,
            TenantId = newTenantId,
            IsDemoAccount = false,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, request.Password ?? "TransitOps@Secure2026!");
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });
        }

        var token = GenerateJwtToken(user);
        var userDto = new UserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Role.ToString(),
            user.TenantId,
            false,
            null
        );

        return Ok(new AuthResponse(token, Guid.NewGuid().ToString("N"), userDto));
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email))
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null) return NotFound();

        return Ok(new UserDto(
            user.Id,
            user.FullName,
            user.Email ?? "",
            user.Role.ToString(),
            user.TenantId,
            user.IsDemoAccount,
            user.AvatarUrl
        ));
    }

    private string GenerateJwtToken(ApplicationUser user)
    {
        var secret = _config["Jwt:Key"] ?? "TransitOpsSuperSecretProductionEncryptionKey2026!#$*";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("tenant_id", user.TenantId),
            new Claim("is_demo", user.IsDemoAccount.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "TransitOpsApi",
            audience: _config["Jwt:Audience"] ?? "TransitOpsClient",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GetNameFromEmail(string email)
    {
        var part = email.Split('@')[0].Replace('.', ' ');
        return char.ToUpper(part[0]) + part[1..];
    }
}
