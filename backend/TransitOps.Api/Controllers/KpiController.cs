using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TransitOps.Application.Services;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class KpiController : ControllerBase
{
    private readonly IKpiService _kpiService;

    public KpiController(IKpiService kpiService)
    {
        _kpiService = kpiService;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException("The authenticated user has no tenant.");

    [HttpGet("fleet")]
    [Authorize(Roles = "FleetManager")]
    public async Task<IActionResult> GetFleetKpis(CancellationToken ct)
    {
        var result = await _kpiService.GetFleetKpisAsync(GetTenantId(), ct);
        return Ok(result);
    }

    [HttpGet("driver")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> GetDriverKpis([FromQuery] Guid? driverId, CancellationToken ct)
    {
        var result = await _kpiService.GetDriverKpisAsync(GetTenantId(), driverId, ct);
        return Ok(result);
    }

    [HttpGet("safety")]
    [Authorize(Roles = "SafetyOfficer")]
    public async Task<IActionResult> GetSafetyKpis(CancellationToken ct)
    {
        var result = await _kpiService.GetSafetyKpisAsync(GetTenantId(), ct);
        return Ok(result);
    }

    [HttpGet("financial")]
    [Authorize(Roles = "FinancialAnalyst")]
    public async Task<IActionResult> GetFinancialKpis(CancellationToken ct)
    {
        var result = await _kpiService.GetFinancialKpisAsync(GetTenantId(), ct);
        return Ok(result);
    }
}
