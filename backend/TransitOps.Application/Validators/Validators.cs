using FluentValidation;
using TransitOps.Application.DTOs;
using TransitOps.Domain.Enums;

namespace TransitOps.Application.Validators;

public class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().EmailAddress();
        RuleFor(x => x.Password)
            .NotEmpty();
    }
}

public class CreateOrganizationUserValidator : AbstractValidator<CreateOrganizationUserRequest>
{
    public CreateOrganizationUserValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .MaximumLength(100);
        RuleFor(x => x.Email)
            .NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password)
            .NotEmpty().MinimumLength(10)
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain a digit.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Password must contain a non-alphanumeric character.");
        RuleFor(x => x.Role).IsInEnum()
            .Must(role => role != UserRole.OrganizationAdmin)
            .WithMessage("Organization administrators can only be provisioned through the trusted organization setup process.");
        When(x => x.Role == UserRole.Driver, () =>
        {
            RuleFor(x => x.ContactNumber).NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).MaximumLength(32);
            RuleFor(x => x.LicenseNumber).NotEmpty().Custom(IndianRules.LicenceNumber);
            RuleFor(x => x.LicenseCategory).NotEmpty().Custom(IndianRules.LicenceClasses);
            RuleFor(x => x.LicenseExpiryDate).NotNull()
                .Custom((expiry, context) => IndianRules.LicenceExpiry(context.InstanceToValidate.LicenseNumber, expiry, context));
        });
    }
}

public class UpdateOrganizationUserValidator : AbstractValidator<UpdateOrganizationUserRequest>
{
    public UpdateOrganizationUserValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .MaximumLength(100);
        RuleFor(x => x.Email)
            .NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Role).IsInEnum();
        When(x => x.Role == UserRole.Driver, () =>
        {
            RuleFor(x => x.ContactNumber).NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).MaximumLength(32);
            RuleFor(x => x.LicenseNumber).NotEmpty().Custom(IndianRules.LicenceNumber);
            RuleFor(x => x.LicenseCategory).NotEmpty().Custom(IndianRules.LicenceClasses);
            RuleFor(x => x.LicenseExpiryDate).NotNull()
                .Custom((expiry, context) => IndianRules.LicenceExpiry(context.InstanceToValidate.LicenseNumber, expiry, context));
        });
    }
}

public class CreateVehicleValidator : AbstractValidator<CreateVehicleRequest>
{
    public CreateVehicleValidator()
    {
        RuleFor(x => x.RegistrationNumber)
            .NotEmpty().WithMessage("Registration / License plate number is required.")
            .MaximumLength(32).WithMessage("Registration number cannot exceed 32 characters.")
            .Custom(IndianRules.RegistrationNumber);

        RuleFor(x => x.Name)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .WithMessage("Vehicle name or nickname is required.");

        RuleFor(x => x.Model)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .MaximumLength(100);

        RuleFor(x => x.Type)
            .IsInEnum();

        RuleFor(x => x.MaxCapacityKg)
            .GreaterThan(0).WithMessage("Max cargo payload capacity must be greater than 0 kg.");

        RuleFor(x => x.AcquisitionCost)
            .GreaterThanOrEqualTo(0).WithMessage("Acquisition cost cannot be negative.");

        RuleFor(x => x.CurrentOdometerKm)
            .GreaterThanOrEqualTo(0).WithMessage("Odometer reading cannot be negative.");

        RuleFor(x => x.Region)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .MaximumLength(100);
    }
}

public class CreateDriverValidator : AbstractValidator<CreateDriverRequest>
{
    public CreateDriverValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .WithMessage("Driver full name is required.")
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address must be provided.");

        RuleFor(x => x.LicenseNumber)
            .NotEmpty().WithMessage("Commercial driver permit / license number is mandatory.")
            .Custom(IndianRules.LicenceNumber);

        RuleFor(x => x.LicenseCategory)
            .NotEmpty()
            .Custom(IndianRules.LicenceClasses);

        RuleFor(x => x.ContactNumber)
            .NotEmpty()
            .Must(value => System.Text.RegularExpressions.Regex.IsMatch(
                value.Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", ""),
                @"^\+?[1-9]\d{6,14}$"))
            .WithMessage("Contact number must be a valid international phone number.");

        RuleFor(x => x.LicenseExpiryDate)
            .NotEmpty().WithMessage("License expiry date is required.")
            .Custom((expiry, context) => IndianRules.LicenceExpiry(context.InstanceToValidate.LicenseNumber, expiry, context));
    }
}


public class CreateTripValidator : AbstractValidator<CreateTripRequest>
{
    public CreateTripValidator()
    {
        RuleFor(x => x.Source)
            .NotEmpty().WithMessage("Source departure depot or city is required.");

        RuleFor(x => x.Destination)
            .NotEmpty().WithMessage("Destination delivery hub or city is required.");

        RuleFor(x => x.VehicleId)
            .NotEmpty().WithMessage("Vehicle assignment is required.");

        RuleFor(x => x.DriverId)
            .NotEmpty().WithMessage("Driver assignment is required.");

        RuleFor(x => x.CargoWeightKg)
            .GreaterThan(0).WithMessage("Cargo weight must be greater than 0 kg.");

        RuleFor(x => x.PlannedDistanceKm)
            .GreaterThan(0).WithMessage("Planned distance must be greater than 0 km.");
    }
}

public class CompleteTripValidator : AbstractValidator<CompleteTripRequest>
{
    public CompleteTripValidator()
    {
        RuleFor(x => x.FinalOdometerKm)
            .GreaterThan(0).WithMessage("Final odometer reading must be greater than 0.");

        RuleFor(x => x.FuelConsumedLiters)
            .GreaterThanOrEqualTo(0).WithMessage("Fuel consumed cannot be negative.");
    }
}

public class CreateMaintenanceValidator : AbstractValidator<CreateMaintenanceRequest>
{
    public CreateMaintenanceValidator()
    {
        RuleFor(x => x.VehicleId)
            .NotEmpty().WithMessage("Target vehicle is required.");

        RuleFor(x => x.ServiceType)
            .NotEmpty().WithMessage("Service type must be specified.");

        RuleFor(x => x.Cost)
            .GreaterThanOrEqualTo(0).WithMessage("Cost cannot be negative.");
    }
}

public class CreateExpenseValidator : AbstractValidator<CreateExpenseRequest>
{
    public CreateExpenseValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Expense amount must be greater than 0.");
    }
}

/// <summary>FluentValidation adapters for <see cref="IndianRegulatoryFormats"/>.</summary>
public static class IndianRules
{
    /// <summary>Licences are issued for at most 20 years (non-transport) and usually 5 (transport).</summary>
    public const int MaxLicenceValidityYears = 20;

    public static void RegistrationNumber<T>(string? value, ValidationContext<T> context)
    {
        if (!string.IsNullOrWhiteSpace(value) &&
            !IndianRegulatoryFormats.TryNormalizeRegistration(value, out _, out var error))
            context.AddFailure(error);
    }

    public static void LicenceNumber<T>(string? value, ValidationContext<T> context)
    {
        if (!string.IsNullOrWhiteSpace(value) &&
            !IndianRegulatoryFormats.TryNormalizeLicence(value, out _, out var error))
            context.AddFailure(error);
    }

    public static void LicenceClasses<T>(string? value, ValidationContext<T> context)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        var invalid = SplitClasses(value).Where(c => !IndianRegulatoryFormats.LicenceClasses.Contains(c)).ToList();
        if (invalid.Count > 0)
            context.AddFailure(
                $"Unknown licence class '{string.Join(", ", invalid)}'. Use classes such as LMV, LMV-TR, MGV, HMV, HGMV, HPMV or HTV.");
    }

    public static void LicenceExpiry<T>(string? licenceNumber, DateOnly? expiry, ValidationContext<T> context)
    {
        if (expiry is null) return;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (expiry.Value > today.AddYears(MaxLicenceValidityYears))
            context.AddFailure($"Licence expiry cannot be more than {MaxLicenceValidityYears} years in the future.");
        var issueYear = IndianRegulatoryFormats.LicenceIssueYear(licenceNumber);
        if (issueYear is not null && expiry.Value.Year < issueYear.Value)
            context.AddFailure($"Licence expiry cannot be before its issue year ({issueYear}).");
    }

    /// <summary>Accepts one class or several separated by commas or slashes, e.g. "LMV, HGMV".</summary>
    public static IEnumerable<string> SplitClasses(string value) =>
        value.Split([',', '/', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(c => c.ToUpperInvariant());

    public static string NormalizeClasses(string value) => string.Join(", ", SplitClasses(value).Distinct());
}
