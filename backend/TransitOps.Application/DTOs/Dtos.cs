using TransitOps.Domain.Enums;

namespace TransitOps.Application.DTOs;

public record LoginRequest(string Email, string Password, string? Role);
public record RegisterRequest(string FullName, string Email, string Password, string Role);
public record AuthResponse(string Token, string RefreshToken, UserDto User);
public record UserDto(string Id, string FullName, string Email, string Role, string TenantId, bool IsDemoAccount, string? AvatarUrl);

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
    string? Name,
    string? Model,
    VehicleType? Type,
    int? MaxCapacityKg,
    int? CurrentOdometerKm,
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
    string? LicenseCategory,
    DateOnly? LicenseExpiryDate,
    DriverStatus? Status,
    int? SafetyScore
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

public record CreateExpenseRequest(
    Guid? VehicleId,
    Guid? TripId,
    ExpenseType Type,
    decimal Amount, // INR (₹)
    decimal? Liters,
    int? OdometerReading,
    DateTime? ExpenseDate,
    string? Notes
);

public record FleetKpiDto(
    int TotalVehicles,
    int ActiveDispatches,
    int AvailableAssets,
    int MaintenanceHolds,
    double FleetUtilizationRate,
    int TotalTripsInProgress,
    int PendingDepartures
);

public record DriverKpiDto(
    int PendingDepartures,
    int ActiveDeliveries,
    int DeliveredRunsToday,
    int TotalTripsCompleted,
    double OnTimeDepartureRate
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
