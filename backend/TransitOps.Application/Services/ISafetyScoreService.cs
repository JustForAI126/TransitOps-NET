using TransitOps.Application.Safety;

namespace TransitOps.Application.Services;

public interface ISafetyScoreService
{
    /// <summary>Calculates a driver's score with its breakdown, without saving it.</summary>
    Task<SafetyScoreResult?> GetBreakdownAsync(string tenantId, Guid driverId, CancellationToken ct = default);

    /// <summary>Recalculates and stores one driver's score. Caller saves changes.</summary>
    Task<SafetyScoreResult?> RecalculateAsync(Guid driverId, CancellationToken ct = default);

    /// <summary>Recalculates and saves every driver's score (optionally for one tenant). Returns drivers changed.</summary>
    Task<int> RecalculateAllAsync(string? tenantId = null, CancellationToken ct = default);
}
