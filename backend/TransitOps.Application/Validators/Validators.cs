using FluentValidation;
using TransitOps.Application.DTOs;

namespace TransitOps.Application.Validators;

public class CreateVehicleValidator : AbstractValidator<CreateVehicleRequest>
{
    public CreateVehicleValidator()
    {
        RuleFor(x => x.RegistrationNumber)
            .NotEmpty().WithMessage("Registration / License plate number is required.")
            .MaximumLength(32).WithMessage("Registration number cannot exceed 32 characters.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Vehicle name or nickname is required.");

        RuleFor(x => x.MaxCapacityKg)
            .GreaterThan(0).WithMessage("Max cargo payload capacity must be greater than 0 kg.");

        RuleFor(x => x.AcquisitionCost)
            .GreaterThanOrEqualTo(0).WithMessage("Acquisition cost cannot be negative.");

        RuleFor(x => x.CurrentOdometerKm)
            .GreaterThanOrEqualTo(0).WithMessage("Odometer reading cannot be negative.");
    }
}

public class CreateDriverValidator : AbstractValidator<CreateDriverRequest>
{
    public CreateDriverValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Driver full name is required.")
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address must be provided.");

        RuleFor(x => x.LicenseNumber)
            .NotEmpty().WithMessage("Commercial driver permit / license number is mandatory.");

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
