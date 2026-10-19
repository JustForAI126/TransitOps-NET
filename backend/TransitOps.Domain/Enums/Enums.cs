namespace TransitOps.Domain.Enums;

public enum UserRole
{
    FleetManager,
    Driver,
    SafetyOfficer,
    FinancialAnalyst
}

public enum VehicleStatus
{
    Available,
    OnTrip,
    InShop,
    Retired
}

public enum VehicleType
{
    Van,
    Truck,
    HeavyTruck,
    Pickup,
    SemiTrailer,
    BoxTruck
}

public enum DriverStatus
{
    Available,
    OnDuty,
    OnTrip,
    OffDuty,
    Suspended
}

public enum TripStatus
{
    Draft,
    Dispatched,
    Completed,
    Cancelled
}

public enum MaintenanceStatus
{
    Active,
    Completed
}

public enum ExpenseType
{
    Fuel,
    Toll,
    Maintenance,
    Permit,
    Insurance,
    Other
}
