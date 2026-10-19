using Microsoft.AspNetCore.Mvc;
using TransitOps.Application.Services;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KpiController : ControllerBase
{
    private readonly IKpiService _kpiService;

    public KpiController(IKpiService kpiService)
    {
        _kpiService = kpiService;
    }

    private string GetTenantId() => User.FindFirst("tenant_id")?.Value ?? "demo_tenant";

    [HttpGet("fleet")]
    public async Task<IActionResult> GetFleetKpis(CancellationToken ct)
    {
        var result = await _kpiService.GetFleetKpisAsync(GetTenantId(), ct);
        return Ok(result);
    }

    [HttpGet("driver")]
    public async Task<IActionResult> GetDriverKpis([FromQuery] Guid? driverId, CancellationToken ct)
    {
        var result = await _kpiService.GetDriverKpisAsync(GetTenantId(), driverId, ct);
        return Ok(result);
    }

    [HttpGet("safety")]
    public async Task<IActionResult> GetSafetyKpis(CancellationToken ct)
    {
        var result = await _kpiService.GetSafetyKpisAsync(GetTenantId(), ct);
        return Ok(result);
    }

    [HttpGet("financial")]
    public async Task<IActionResult> GetFinancialKpis(CancellationToken ct)
    {
        var result = await _kpiService.GetFinancialKpisAsync(GetTenantId(), ct);
        return Ok(result);
    }
}
