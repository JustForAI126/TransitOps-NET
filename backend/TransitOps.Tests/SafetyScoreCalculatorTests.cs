using TransitOps.Application.Safety;

namespace TransitOps.Tests;

public sealed class SafetyScoreCalculatorTests
{
    private static readonly DateOnly Today = new(2026, 10, 20);
    private static readonly DateOnly ValidLicence = Today.AddYears(2);
    private static readonly DateTime Recent = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private static SafetyTripSample Trip(decimal kmPerLiterRatio, DateTime? completed = null) =>
        new(PlannedDistanceKm: 600, FuelConsumedLiters: 600m / (6m * kmPerLiterRatio), VehicleRatedKmPerLiter: 6m, completed ?? Recent);

    private static SafetyScoreResult Score(int incidents = 0, DateOnly? expiry = null, int completed = 0, params SafetyTripSample[] trips) =>
        SafetyScoreCalculator.Calculate(new SafetyScoreInput(incidents, expiry ?? ValidLicence, completed, trips), Today);

    [Fact]
    public void CleanNewDriverScoresOneHundred()
    {
        var result = Score();
        Assert.Equal(100, result.Score);
        Assert.Equal("Excellent", result.Band);
        Assert.Equal(4, result.Factors.Count);
    }

    [Theory]
    [InlineData(1, 92)]
    [InlineData(3, 76)]
    [InlineData(5, 60)]
    [InlineData(9, 60)] // capped at −40
    public void IncidentsDeductEightPointsUpToForty(int incidents, int expected) =>
        Assert.Equal(expected, Score(incidents).Score);

    [Fact]
    public void ExpiredLicenceDeductsTwentyFive() =>
        Assert.Equal(75, Score(expiry: Today.AddDays(-1)).Score);

    [Fact]
    public void LicenceExpiringWithinThirtyDaysDeductsFive()
    {
        Assert.Equal(95, Score(expiry: Today.AddDays(30)).Score);
        Assert.Equal(100, Score(expiry: Today.AddDays(31)).Score);
    }

    [Fact]
    public void FuelFactorNeedsThreeRecentTrips() =>
        Assert.Equal(100, Score(trips: [Trip(0.5m), Trip(0.5m)]).Score);

    [Fact]
    public void FuelPenaltyIsShareOfInefficientTrips()
    {
        // 2 of 4 trips below 85% of rated km/L → 15 × 0.5 = 7.5 → 8
        var result = Score(trips: [Trip(0.70m), Trip(0.80m), Trip(0.95m), Trip(1.0m)]);
        Assert.Equal(92, result.Score);
    }

    [Fact]
    public void TripsOutsideNinetyDayWindowAreIgnored()
    {
        var old = Today.AddDays(-91).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        Assert.Equal(100, Score(trips: [Trip(0.5m, old), Trip(0.5m, old), Trip(0.5m, old)]).Score);
    }

    [Fact]
    public void ExperienceRecoversDeductionsButNeverExceedsOneHundred()
    {
        Assert.Equal(97, Score(incidents: 1, completed: 125).Score); // 100 − 8 + 5
        Assert.Equal(100, Score(completed: 500).Score);
    }

    [Fact]
    public void ScoreNeverDropsBelowZeroAndBandsMatchThresholds()
    {
        var worst = Score(incidents: 20, expiry: Today.AddYears(-1), trips: [Trip(0.1m), Trip(0.1m), Trip(0.1m)]);
        Assert.Equal(20, worst.Score); // 100 − 40 − 25 − 15
        Assert.Equal("High risk", worst.Band);
        Assert.Equal("Good", SafetyScoreCalculator.BandFor(75));
        Assert.Equal("Needs attention", SafetyScoreCalculator.BandFor(74));
        Assert.Equal("High risk", SafetyScoreCalculator.BandFor(59));
    }
}
