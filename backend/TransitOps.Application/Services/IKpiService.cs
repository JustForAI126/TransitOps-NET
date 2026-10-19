using TransitOps.Application.DTOs;

namespace TransitOps.Application.Services;

public interface IKpiService
{
    Task<FleetKpiDto> GetFleetKpisAsync(string tenantId, CancellationToken ct = default);
    Task<DriverKpiDto> GetDriverKpisAsync(string tenantId, Guid? driverId = null, CancellationToken ct = default);
    Task<SafetyKpiDto> GetSafetyKpisAsync(string tenantId, CancellationToken ct = default);
    Task<FinancialKpiDto> GetFinancialKpisAsync(string tenantId, CancellationToken ct = default);
}
