using System.Text.RegularExpressions;

namespace TransitOps.Application.Validators;

/// <summary>
/// Indian vehicle registration marks and driving licence numbers.
/// Registration: Central Motor Vehicles Rules, 1989 (rule 50) "SS RR XX NNNN" marks and the
/// Bharat (BH) series introduced by MoRTH notification G.S.R. 594(E), 26 Aug 2021.
/// Driving licence: the Sarathi national format "SS RR YYYY NNNNNNN" (15 characters).
/// </summary>
public static partial class IndianRegulatoryFormats
{
    /// <summary>State/UT codes, including legacy codes (DN, OR, UA, TS) still printed on older documents.</summary>
    public static readonly IReadOnlySet<string> StateCodes = new HashSet<string>(StringComparer.Ordinal)
    {
        "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HP", "HR",
        "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR",
        "PB", "PY", "RJ", "SK", "TG", "TN", "TR", "TS", "UA", "UK", "UP", "WB"
    };

    /// <summary>Licence classes under section 10 of the Motor Vehicles Act, 1988 (as used by Sarathi).</summary>
    public static readonly IReadOnlySet<string> LicenceClasses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "MCWG", "MCWOG", "LMV", "LMV-NT", "LMV-TR", "MGV", "HMV", "HGMV", "HPMV", "HTV", "TRANS"
    };

    public const string RegistrationExample = "MH-12-AB-1234 or 22-BH-1234-AA";
    public const string LicenceExample = "MH14 20180045921";

    [GeneratedRegex(@"[\s\-./]")]
    private static partial Regex Separators();

    // DL + RTO number + vehicle-category letter (C, S, L, ...) + optional series + number, e.g. DL-1C-AB-1234.
    [GeneratedRegex(@"^DL(\d{1,2})([A-Z])([A-Z]{0,2})(\d{1,4})$")]
    private static partial Regex DelhiRegistration();

    // State + RTO + optional 1-3 letter series + 1-4 digit number, e.g. MH-12-AB-1234.
    [GeneratedRegex(@"^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$")]
    private static partial Regex StandardRegistration();

    // YY BH #### XX; the notification excludes the letters I and O from the series.
    [GeneratedRegex(@"^(\d{2})BH(\d{4})([A-HJ-NP-Z]{1,2})$")]
    private static partial Regex BharatSeriesRegistration();

    // State + 2-character RTO code + 4-digit issue year + 7-digit serial.
    [GeneratedRegex(@"^([A-Z]{2})(\d[0-9A-Z])(\d{4})(\d{7})$")]
    private static partial Regex DrivingLicence();

    private static string Compact(string value) =>
        Separators().Replace(value.Trim().ToUpperInvariant(), string.Empty);

    /// <summary>Validates a registration mark and returns it in canonical hyphenated form.</summary>
    public static bool TryNormalizeRegistration(string? input, out string normalized, out string error)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input))
        {
            error = "Registration number is required.";
            return false;
        }

        var compact = Compact(input);

        var bh = BharatSeriesRegistration().Match(compact);
        if (bh.Success)
        {
            var year = int.Parse(bh.Groups[1].Value);
            if (year < 21 || year > DateTime.UtcNow.Year % 100)
            {
                error = "Bharat (BH) series year must be between 21 and the current year.";
                return false;
            }
            if (bh.Groups[2].Value == "0000")
            {
                error = "Registration number cannot be 0000.";
                return false;
            }
            normalized = $"{bh.Groups[1].Value}-BH-{bh.Groups[2].Value}-{bh.Groups[3].Value}";
            error = string.Empty;
            return true;
        }
        if (compact.Length >= 4 && compact.Substring(2, 2) == "BH" && char.IsDigit(compact[0]))
        {
            error = "Bharat (BH) series numbers look like 22-BH-1234-AA (series letters cannot be I or O).";
            return false;
        }

        var delhi = DelhiRegistration().Match(compact);
        var match = delhi.Success ? delhi : StandardRegistration().Match(compact);
        if (!match.Success)
        {
            error = $"Registration number must follow the Indian format, e.g. {RegistrationExample}.";
            return false;
        }

        var state = compact[..2];
        if (!StateCodes.Contains(state))
        {
            error = $"'{state}' is not a valid Indian state/UT code.";
            return false;
        }

        // Delhi groups: RTO, category, series, number. Standard groups: state, RTO, series, number.
        var rto = int.Parse(match.Groups[delhi.Success ? 1 : 2].Value);
        var number = int.Parse(match.Groups[4].Value);
        if (rto == 0)
        {
            error = "RTO code cannot be 00.";
            return false;
        }
        if (number == 0)
        {
            error = "Registration number cannot be 0000.";
            return false;
        }

        if (delhi.Success)
        {
            var series = delhi.Groups[3].Value;
            normalized = $"DL-{rto}{delhi.Groups[2].Value}-{(series.Length > 0 ? series + "-" : string.Empty)}{number:0000}";
        }
        else
        {
            var series = match.Groups[3].Value;
            normalized = $"{state}-{rto:00}-{(series.Length > 0 ? series + "-" : string.Empty)}{number:0000}";
        }
        error = string.Empty;
        return true;
    }

    /// <summary>Validates a driving licence number and returns it as 15 characters without separators.</summary>
    public static bool TryNormalizeLicence(string? input, out string normalized, out string error) =>
        TryNormalizeLicence(input, DateOnly.FromDateTime(DateTime.UtcNow), out normalized, out error);

    public static bool TryNormalizeLicence(string? input, DateOnly today, out string normalized, out string error)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input))
        {
            error = "Driving licence number is required.";
            return false;
        }

        var compact = Compact(input);
        var match = DrivingLicence().Match(compact);
        if (!match.Success)
        {
            error = $"Driving licence number must be 15 characters: state code, RTO code, issue year and 7-digit serial, e.g. {LicenceExample}.";
            return false;
        }

        var state = match.Groups[1].Value;
        if (!StateCodes.Contains(state))
        {
            error = $"'{state}' is not a valid Indian state/UT code.";
            return false;
        }
        if (match.Groups[2].Value == "00")
        {
            error = "RTO code in the licence number cannot be 00.";
            return false;
        }

        var issueYear = int.Parse(match.Groups[3].Value);
        if (issueYear < 1950 || issueYear > today.Year)
        {
            error = $"Issue year {issueYear} in the licence number is not valid.";
            return false;
        }
        if (match.Groups[4].Value == "0000000")
        {
            error = "Licence serial number cannot be all zeros.";
            return false;
        }

        normalized = compact;
        error = string.Empty;
        return true;
    }

    /// <summary>Issue year encoded in a valid licence number, or null.</summary>
    public static int? LicenceIssueYear(string? licenceNumber) =>
        TryNormalizeLicence(licenceNumber, out var normalized, out _) ? int.Parse(normalized.Substring(4, 4)) : null;

    /// <summary>Uppercase form with spaces, hyphens, dots and slashes removed, for duplicate comparison.</summary>
    public static string CompactForComparison(string value) => Compact(value);
}
