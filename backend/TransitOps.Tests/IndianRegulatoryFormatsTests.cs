using TransitOps.Application.DTOs;
using TransitOps.Application.Validators;
using TransitOps.Domain.Enums;

namespace TransitOps.Tests;

public sealed class IndianRegulatoryFormatsTests
{
    [Theory]
    [InlineData("MH-12-AB-1234", "MH-12-AB-1234")]
    [InlineData("mh12ab1234", "MH-12-AB-1234")]
    [InlineData("MH 12 AB 1234", "MH-12-AB-1234")]
    [InlineData("KA-3-PL-5174", "KA-03-PL-5174")]
    [InlineData("GJ01RM742", "GJ-01-RM-0742")]
    [InlineData("TN09C6308", "TN-09-C-6308")]
    [InlineData("UP32ABC1234", "UP-32-ABC-1234")]
    [InlineData("MH121234", "MH-12-1234")]
    [InlineData("DL-1C-AB-1234", "DL-1C-AB-1234")]
    [InlineData("DL1LAB9081", "DL-1L-AB-9081")]
    [InlineData("DL 10 C AA 0001", "DL-10C-AA-0001")]
    [InlineData("22 BH 1234 AA", "22-BH-1234-AA")]
    [InlineData("21BH0001C", "21-BH-0001-C")]
    public void ValidRegistrationsAreNormalized(string input, string expected)
    {
        Assert.True(IndianRegulatoryFormats.TryNormalizeRegistration(input, out var normalized, out var error), error);
        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData("")]
    [InlineData("ABC123")]
    [InlineData("XX-12-AB-1234")]          // unknown state code
    [InlineData("MH-00-AB-1234")]          // RTO 00
    [InlineData("MH-12-AB-0000")]          // number 0000
    [InlineData("MH-12-ABCD-1234")]        // series too long
    [InlineData("MH-12-AB-12345")]         // number too long
    [InlineData("20-BH-1234-AA")]          // BH series started in 2021
    [InlineData("22-BH-1234-IO")]          // I and O not allowed in BH series
    [InlineData("22-BH-123-AA")]
    public void InvalidRegistrationsAreRejected(string input)
    {
        Assert.False(IndianRegulatoryFormats.TryNormalizeRegistration(input, out _, out var error));
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Theory]
    [InlineData("MH1420180045921", "MH1420180045921")]
    [InlineData("MH14 20180045921", "MH1420180045921")]
    [InlineData("mh-14-2018-0045921", "MH1420180045921")]
    [InlineData("DL1L20220087114", "DL1L20220087114")]
    [InlineData("TS0820190019726", "TS0820190019726")]
    public void ValidLicencesAreNormalized(string input, string expected)
    {
        Assert.True(IndianRegulatoryFormats.TryNormalizeLicence(input, new DateOnly(2026, 10, 20), out var normalized, out var error), error);
        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData("MH142018004592")]     // 14 characters
    [InlineData("MH14201800459212")]   // 16 characters
    [InlineData("ZZ1420180045921")]    // unknown state
    [InlineData("MH0020180045921")]    // RTO 00
    [InlineData("MH1419400045921")]    // issue year before 1950
    [InlineData("MH1420300045921")]    // issue year in the future
    [InlineData("MH1420180000000")]    // zero serial
    [InlineData("1420180045921MH")]
    public void InvalidLicencesAreRejected(string input)
    {
        Assert.False(IndianRegulatoryFormats.TryNormalizeLicence(input, new DateOnly(2026, 10, 20), out _, out var error));
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public void VehicleValidatorRejectsNonIndianRegistration()
    {
        var request = new CreateVehicleRequest("ABC-123", "Test truck", "Tata LPT", VehicleType.Truck, 5000, 0, 100000, "West");
        var result = new CreateVehicleValidator().Validate(request);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateVehicleRequest.RegistrationNumber));
    }

    [Fact]
    public void DriverValidatorChecksLicenceNumberClassAndExpiry()
    {
        var expiry = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(30));
        var request = new CreateDriverRequest("Test Driver", "t@example.com", "+919822034117", "MH14 2018 0045921", "Heavy Commercial", expiry);
        var result = new CreateDriverValidator().Validate(request);

        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(CreateDriverRequest.LicenseNumber));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateDriverRequest.LicenseCategory));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateDriverRequest.LicenseExpiryDate));
    }

    [Theory]
    [InlineData("HGMV", true)]
    [InlineData("lmv-tr", true)]
    [InlineData("LMV, HGMV", true)]
    [InlineData("LMV/HPMV", true)]
    [InlineData("Truck licence", false)]
    public void LicenceClassesFollowMotorVehiclesAct(string value, bool valid)
    {
        var request = new CreateDriverRequest("Test Driver", "t@example.com", "+919822034117", "MH1420180045921", value,
            DateOnly.FromDateTime(DateTime.UtcNow.AddYears(2)));
        var result = new CreateDriverValidator().Validate(request);
        Assert.Equal(valid, result.Errors.All(e => e.PropertyName != nameof(CreateDriverRequest.LicenseCategory)));
    }
}
