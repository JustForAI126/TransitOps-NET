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
            RuleFor(x => x.LicenseNumber).NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).MaximumLength(64);
            RuleFor(x => x.LicenseCategory).NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).MaximumLength(64);
            RuleFor(x => x.LicenseExpiryDate).NotNull();
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
            RuleFor(x => x.LicenseNumber).NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).MaximumLength(64);
            RuleFor(x => x.LicenseCategory).NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).MaximumLength(64);
            RuleFor(x => x.LicenseExpiryDate).NotNull();
        });
    }
}

public class CreateVehicleValidator : AbstractValidator<CreateVehicleRequest>
{
    public CreateVehicleValidator()
    {
        RuleFor(x => x.RegistrationNumber)
            .NotEmpty().WithMessage("Registration / License plate number is required.")
            .Must(value => !string.IsNullOrWhiteSpace(value))
            .MaximumLength(32).WithMessage("Registration number cannot exceed 32 characters.");

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
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .WithMessage("Commercial driver permit / license number is mandatory.")
            .MaximumLength(64);

        RuleFor(x => x.LicenseCategory)
            .NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value))
            .MaximumLength(64);

        RuleFor(x => x.ContactNumber)
            .NotEmpty()
            .Must(value => System.Text.RegularExpressions.Regex.IsMatch(
                value.Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", ""),
                @"^\+?[1-9]\d{6,14}$"))
            .WithMessage("Contact number must be a valid international phone number.");

        RuleFor(x => x.LicenseExpiryDate)
            .NotEmpty().WithMessage("License expiry date is required.");
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
