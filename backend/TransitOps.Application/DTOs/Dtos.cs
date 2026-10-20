using TransitOps.Domain.Enums;

namespace TransitOps.Application.DTOs;

/// <summary>Credentials for an existing TransitOps account.</summary>
public sealed record LoginRequest(string Email, string Password);

/// <summary>Information about an account in an organization.</summary>
public sealed record OrganizationUserResponse(
    string Id,
    string FullName,
    string Email,
    string Role,
    Guid? DriverId,
    string? ContactNumber = null,
    string? LicenseNumber = null,
    string? LicenseCategory = null,
    DateOnly? LicenseExpiryDate = null);

/// <summary>Details an organization administrator needs to provision a user account.</summary>
public sealed record CreateOrganizationUserRequest(
    string FullName,
    string Email,
    string Password,
    UserRole Role,
    string? ContactNumber,
    string? LicenseNumber,
    string? LicenseCategory,
    DateOnly? LicenseExpiryDate);

/// <summary>Editable organization account details and assigned built-in role.</summary>
public sealed record UpdateOrganizationUserRequest(
    string FullName,
    string Email,
    UserRole Role,
    string? ContactNumber,
    string? LicenseNumber,
    string? LicenseCategory,
    DateOnly? LicenseExpiryDate);

/// <summary>The authenticated account profile returned by the API.</summary>
public record UserDto(string Id, string FullName, string Email, string Role, string TenantId, bool IsDemoAccount, string? AvatarUrl);

/// <summary>A vehicle returned to an authorized fleet user.</summary>
public sealed record VehicleResponse(
    Guid Id,
    string RegistrationNumber,
    string Name,
    string Model,
    VehicleType Type,
    int MaxCapacityKg,
    int CurrentOdometerKm,
    decimal? AcquisitionCost,
    VehicleStatus Status,
    string Region,
    decimal? RevenueGenerated,
    decimal FuelEfficiencyKmPerLiter,
    IReadOnlyList<VehicleDocumentResponse> Documents,
    DateTimeOffset CreatedAt);

/// <summary>A vehicle compliance document.</summary>
public sealed record VehicleDocumentResponse(
    string Type,
    DateTimeOffset ExpiryDate,
    string Status);

/// <summary>A trip returned without exposing unauthorized financial information.</summary>
public sealed record TripResponse(
    Guid Id,
    string TripCode,
    string Source,
    string Destination,
    Guid VehicleId,
    string VehicleRegNumber,
    string VehicleName,
    Guid DriverId,
    string DriverName,
    int CargoWeightKg,
    int PlannedDistanceKm,
    int? FinalOdometerKm,
    decimal? FuelConsumedLiters,
    decimal? Revenue,
    TripStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? DispatchedAt,
    DateTimeOffset? CompletedAt);

public record CreateVehicleRequest(
    string RegistrationNumber,
    string Name,
    string Model,
    VehicleType Type,
    int MaxCapacityKg,
    int CurrentOdometerKm,
    decimal AcquisitionCost, // INR (₹)
    string Region
);

public record UpdateVehicleRequest(
    string? RegistrationNumber,
    string? Name,
    string? Model,
    VehicleType? Type,
    int? MaxCapacityKg,
    int? CurrentOdometerKm,
    decimal? AcquisitionCost,
    VehicleStatus? Status,
    string? Region
);

public record UpdateVehicleStatusDto(string Status);

public record CreateDriverRequest(
    string Name,
    string Email,
    string ContactNumber,
    string LicenseNumber,
    string LicenseCategory,
    DateOnly LicenseExpiryDate
);

public record UpdateDriverRequest(
    string? Name,
    string? ContactNumber,
    string? LicenseNumber,
    string? LicenseCategory,
    DateOnly? LicenseExpiryDate,
    DriverStatus? Status
);

public record CreateTripRequest(
    string Source,
    string Destination,
    Guid VehicleId,
    Guid DriverId,
    int CargoWeightKg,
    int PlannedDistanceKm,
    decimal? Revenue // INR (₹)
);

public record CompleteTripRequest(
    int FinalOdometerKm,
    decimal FuelConsumedLiters
);

public record CreateMaintenanceRequest(
    Guid VehicleId,
    string ServiceType,
    string Description,
    decimal Cost, // INR (₹)
    string? TechnicianNotes
);

public record CompleteMaintenanceRequest(
    decimal? FinalCost,
    string? TechnicianNotes
);

public sealed record MaintenanceRecordResponse(
    Guid Id,
    Guid VehicleId,
    string VehicleRegNumber,
    string VehicleName,
    string ServiceType,
    string Description,
    decimal Cost,
    DateTimeOffset Date,
    DateTimeOffset StartDate,
    DateTimeOffset? CompletedDate,
    string Status,
    string? TechnicianNotes);

public record CreateExpenseRequest(
    Guid? VehicleId,
    Guid? TripId,
    ExpenseType Type,
    decimal Amount, // INR (₹)
    decimal? Liters,
    int? OdometerReading,
    DateTimeOffset? ExpenseDate,
    string? Notes
);

public sealed record ExpenseRecordResponse(
    Guid Id,
    Guid? VehicleId,
    Guid? TripId,
    ExpenseType Type,
    decimal Amount,
    decimal? Liters,
    int? OdometerReading,
    DateTimeOffset ExpenseDate,
    string? Notes);

public record FleetKpiDto(
    int TotalVehicles,
    int ActiveVehicles,
    int ActiveDispatches,
    int AvailableAssets,
    int MaintenanceHolds,
    double FleetUtilizationRate,
    int TotalTripsInProgress,
    int PendingDepartures,
    int DriversOnDuty
);

public record DriverKpiDto(
    int PendingDepartures,
    int ActiveDeliveries,
    int DeliveredRunsToday,
    int TotalTripsCompleted,
    double? OnTimeDepartureRate
);

public record SafetyKpiDto(
    int ExpiredLicenses,
    int ExpiringSoon,
    int SuspendedDrivers,
    int CompliantDrivers,
    int InShopInspectionLocks,
    double AverageSafetyScore
);

public record FinancialKpiDto(
    decimal TotalOpex,
    decimal FuelSpend,
    decimal MaintenanceSpend,
    decimal GrossRevenue,
    decimal NetProfit,
    decimal NetMarginPercentage,
    decimal CostPerKm,
    string Currency = "INR"
);
