using Microsoft.AspNetCore.Identity;
using TransitOps.Domain.Enums;

namespace TransitOps.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.FleetManager;
    public string? AvatarUrl { get; set; }
    public string TenantId { get; set; } = string.Empty; // Multi-tenant isolation
    public bool IsDemoAccount { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TenantId { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public VehicleType Type { get; set; } = VehicleType.Truck;
    public int MaxCapacityKg { get; set; }
    public int CurrentOdometerKm { get; set; }
    public decimal AcquisitionCost { get; set; } // INR (₹)
    public VehicleStatus Status { get; set; } = VehicleStatus.Available;
    public string Region { get; set; } = "North Corridor";
    public decimal RevenueGenerated { get; set; }
    public decimal FuelEfficiencyKmPerLiter { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<VehicleDocument> Documents { get; set; } = new List<VehicleDocument>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
    public ICollection<MaintenanceRecord> MaintenanceRecords { get; set; } = new List<MaintenanceRecord>();
    public ICollection<ExpenseRecord> Expenses { get; set; } = new List<ExpenseRecord>();
}

public class VehicleDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public string Type { get; set; } = string.Empty; // Insurance, Annual Fitness, Hazmat Permit
    public DateTime ExpiryDate { get; set; }
    public string Status { get; set; } = "Valid";
}

public class Driver
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string LicenseNumber { get; set; } = string.Empty;
    public string LicenseCategory { get; set; } = string.Empty;
    public DateOnly LicenseExpiryDate { get; set; }
    public int SafetyScore { get; set; } = 100;
    public DriverStatus Status { get; set; } = DriverStatus.Available;
    public int IncidentHistoryCount { get; set; } = 0;
    public int TotalTripsCompleted { get; set; } = 0;
    public string? Avatar { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}

public class Trip
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TenantId { get; set; } = string.Empty;
    public string TripCode { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;

    public Guid DriverId { get; set; }
    public Driver Driver { get; set; } = null!;

    public int CargoWeightKg { get; set; }
    public int PlannedDistanceKm { get; set; }
    public int? FinalOdometerKm { get; set; }
    public decimal? FuelConsumedLiters { get; set; }
    public decimal Revenue { get; set; } // INR (₹)
    public TripStatus Status { get; set; } = TripStatus.Draft;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DispatchedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    public ICollection<ExpenseRecord> Expenses { get; set; } = new List<ExpenseRecord>();
}

public class MaintenanceRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TenantId { get; set; } = string.Empty;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;

    public string ServiceType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Cost { get; set; } // INR (₹)
    public MaintenanceStatus Status { get; set; } = MaintenanceStatus.Active;
    public string? TechnicianNotes { get; set; }

    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedDate { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class ExpenseRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TenantId { get; set; } = string.Empty;
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }

    public Guid? TripId { get; set; }
    public Trip? Trip { get; set; }

    public ExpenseType Type { get; set; } = ExpenseType.Fuel;
    public decimal Amount { get; set; } // INR (₹)
    public decimal? Liters { get; set; }
    public int? OdometerReading { get; set; }
    public DateTime ExpenseDate { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
