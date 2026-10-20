namespace TransitOps.Application.Safety;

/// <summary>A completed trip used to judge fuel discipline.</summary>
public sealed record SafetyTripSample(
    int PlannedDistanceKm,
    decimal FuelConsumedLiters,
    decimal VehicleRatedKmPerLiter,
    DateTime CompletedAtUtc);

public sealed record SafetyScoreInput(
    int IncidentCount,
    DateOnly LicenseExpiryDate,
    int CompletedTrips,
    IReadOnlyList<SafetyTripSample> RecentTrips);

/// <summary>One line of the score breakdown; negative points are deductions.</summary>
public sealed record SafetyScoreFactor(string Factor, int Points, string Detail);

public sealed record SafetyScoreResult(int Score, string Band, IReadOnlyList<SafetyScoreFactor> Factors);

/// <summary>
/// Driver safety score, 0-100. Starts at 100, then:
/// <list type="bullet">
/// <item>Incidents: −8 per recorded incident, at most −40.</item>
/// <item>Licence: −25 if expired, −5 if it expires within 30 days.</item>
/// <item>Fuel discipline (proxy for harsh driving/idling): over completed trips in the last 90 days,
/// a trip is inefficient when its km/L is below 85% of the vehicle's rated km/L.
/// Deduction = 15 × share of inefficient trips, applied once at least 3 trips are evaluated.</item>
/// <item>Experience: +1 per 25 completed trips, at most +5, which can only recover deductions.</item>
/// </list>
/// The result is clamped to 0-100. Bands: 90+ Excellent, 75-89 Good, 60-74 Needs attention, below 60 High risk.
/// </summary>
public static class SafetyScoreCalculator
{
    public const int IncidentPenalty = 8;
    public const int MaxIncidentPenalty = 40;
    public const int ExpiredLicencePenalty = 25;
    public const int ExpiringLicencePenalty = 5;
    public const int ExpiryWarningDays = 30;
    public const decimal InefficientRatio = 0.85m;
    public const int MaxFuelPenalty = 15;
    public const int FuelWindowDays = 90;
    public const int MinTripsForFuelFactor = 3;
    public const int TripsPerExperiencePoint = 25;
    public const int MaxExperienceBonus = 5;

    public static SafetyScoreResult Calculate(SafetyScoreInput input, DateOnly today)
    {
        var factors = new List<SafetyScoreFactor>();

        var incidentPoints = -Math.Min(Math.Max(input.IncidentCount, 0) * IncidentPenalty, MaxIncidentPenalty);
        factors.Add(new("Incidents", incidentPoints,
            input.IncidentCount == 0
                ? "No recorded incidents"
                : $"{input.IncidentCount} recorded incident(s) × −{IncidentPenalty}, capped at −{MaxIncidentPenalty}"));

        int licencePoints;
        string licenceDetail;
        if (input.LicenseExpiryDate < today)
        {
            licencePoints = -ExpiredLicencePenalty;
            licenceDetail = $"Licence expired on {input.LicenseExpiryDate:yyyy-MM-dd}";
        }
        else if (input.LicenseExpiryDate <= today.AddDays(ExpiryWarningDays))
        {
            licencePoints = -ExpiringLicencePenalty;
            licenceDetail = $"Licence expires on {input.LicenseExpiryDate:yyyy-MM-dd} (within {ExpiryWarningDays} days)";
        }
        else
        {
            licencePoints = 0;
            licenceDetail = "Licence valid";
        }
        factors.Add(new("Licence validity", licencePoints, licenceDetail));

        var windowStart = today.AddDays(-FuelWindowDays).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var evaluated = input.RecentTrips
            .Where(t => t.CompletedAtUtc >= windowStart &&
                t.PlannedDistanceKm > 0 && t.FuelConsumedLiters > 0 && t.VehicleRatedKmPerLiter > 0)
            .ToList();
        var inefficient = evaluated.Count(t =>
            t.PlannedDistanceKm / t.FuelConsumedLiters < t.VehicleRatedKmPerLiter * InefficientRatio);
        int fuelPoints;
        string fuelDetail;
        if (evaluated.Count < MinTripsForFuelFactor)
        {
            fuelPoints = 0;
            fuelDetail = $"Not enough trips with fuel data in the last {FuelWindowDays} days ({evaluated.Count}/{MinTripsForFuelFactor})";
        }
        else
        {
            fuelPoints = -(int)Math.Round(MaxFuelPenalty * (decimal)inefficient / evaluated.Count, MidpointRounding.AwayFromZero);
            fuelDetail = $"{inefficient} of {evaluated.Count} trips below {InefficientRatio:P0} of rated km/L";
        }
        factors.Add(new("Fuel discipline", fuelPoints, fuelDetail));

        var experiencePoints = Math.Min(Math.Max(input.CompletedTrips, 0) / TripsPerExperiencePoint, MaxExperienceBonus);
        factors.Add(new("Experience", experiencePoints,
            $"{input.CompletedTrips} completed trips (+1 per {TripsPerExperiencePoint}, max +{MaxExperienceBonus})"));

        var score = Math.Clamp(100 + factors.Sum(f => f.Points), 0, 100);
        return new SafetyScoreResult(score, BandFor(score), factors);
    }

    public static string BandFor(int score) => score switch
    {
        >= 90 => "Excellent",
        >= 75 => "Good",
        >= 60 => "Needs attention",
        _ => "High risk"
    };
}
