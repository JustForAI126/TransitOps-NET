# 3. Class Diagram (Domain model)

Based on `backend/TransitOps.Domain/Entities/Entities.cs` and `Enums/Enums.cs`.
Every operational entity carries a `TenantId`, so organizations are fully isolated.

```mermaid
classDiagram
    direction LR

    class IdentityUser {
        <<ASP.NET Identity>>
        +string Id
        +string Email
        +string PasswordHash
    }
    class ApplicationUser {
        +string FullName
        +UserRole Role
        +string TenantId
        +bool IsDemoAccount
        +DateTime CreatedAtUtc
    }
    IdentityUser <|-- ApplicationUser

    class Organization {
        +string TenantId «PK»
        +string Name
        +string BillingEmail
    }
    class OrganizationSubscription {
        +Guid Id
        +string TenantId
        +string PlanId
        +long AmountPaise
        +int TermMonths
        +DateTimeOffset StartsAtUtc
        +DateTimeOffset EndsAtUtc
        +string Status
        +string RazorpayOrderId
        +string RazorpayPaymentId
    }
    class SaasPurchase {
        +Guid Id
        +string OrganizationName
        +string Email
        +string PaymentStatus
        +string? PlanId
        +long? AmountPaise
        +string? RazorpayOrderId
        +string? TenantId
        +string? SetupTokenHash
        +DateTimeOffset? ReceiptEmailSentAtUtc
    }
    class RazorpayWebhookReceipt {
        +long Id
        +string EventId «unique»
    }

    class Vehicle {
        +Guid Id
        +string TenantId
        +string RegistrationNumber «unique»
        +string Name
        +string Model
        +VehicleType Type
        +int MaxCapacityKg
        +int CurrentOdometerKm
        +decimal AcquisitionCost
        +VehicleStatus Status
        +string Region
        +decimal RevenueGenerated
    }
    class VehicleDocument {
        +Guid Id
        +string Type
        +DateTime ExpiryDate
        +string Status
    }
    class Driver {
        +Guid Id
        +string TenantId
        +string? IdentityUserId
        +string Name
        +string Email «unique»
        +string ContactNumber
        +string LicenseNumber «unique»
        +string LicenseCategory
        +DateOnly LicenseExpiryDate
        +int SafetyScore
        +DriverStatus Status
        +int IncidentHistoryCount
        +int TotalTripsCompleted
    }
    class Trip {
        +Guid Id
        +string TripCode «unique»
        +string Source
        +string Destination
        +int CargoWeightKg
        +int PlannedDistanceKm
        +int? FinalOdometerKm
        +decimal? FuelConsumedLiters
        +decimal Revenue
        +TripStatus Status
        +DateTime? DispatchedAtUtc
        +DateTime? CompletedAtUtc
    }
    class MaintenanceRecord {
        +Guid Id
        +string ServiceType
        +string Description
        +decimal Cost
        +MaintenanceStatus Status
        +DateTime StartDate
        +DateTime? CompletedDate
    }
    class ExpenseRecord {
        +Guid Id
        +ExpenseType Type
        +decimal Amount
        +decimal? Liters
        +int? OdometerReading
        +DateTime ExpenseDate
    }

    class UserRole {
        <<enumeration>>
        OrganizationAdmin
        FleetManager
        Driver
        SafetyOfficer
        FinancialAnalyst
    }
    class VehicleStatus {
        <<enumeration>>
        Available
        OnTrip
        InShop
        Retired
    }
    class DriverStatus {
        <<enumeration>>
        Available
        OnDuty
        OnTrip
        OffDuty
        Suspended
    }
    class TripStatus {
        <<enumeration>>
        Draft
        Dispatched
        Completed
        Cancelled
    }
    class MaintenanceStatus {
        <<enumeration>>
        Active
        Completed
    }
    class ExpenseType {
        <<enumeration>>
        Fuel
        Toll
        Maintenance
        Permit
        Insurance
        Other
    }

    Organization "1" --> "0..*" OrganizationSubscription : has
    Organization "1" ..> "0..*" ApplicationUser : TenantId
    SaasPurchase "0..1" ..> "1" Organization : provisions
    ApplicationUser "0..1" -- "0..1" Driver : IdentityUserId link
    Vehicle "1" *-- "0..*" VehicleDocument : documents
    Vehicle "1" --> "0..*" Trip : assigned to
    Driver "1" --> "0..*" Trip : drives
    Vehicle "1" --> "0..*" MaintenanceRecord : serviced in
    Vehicle "0..1" --> "0..*" ExpenseRecord : costs
    Trip "0..1" --> "0..*" ExpenseRecord : costs

    ApplicationUser ..> UserRole
    Vehicle ..> VehicleStatus
    Driver ..> DriverStatus
    Trip ..> TripStatus
    MaintenanceRecord ..> MaintenanceStatus
    ExpenseRecord ..> ExpenseType
```

## 3.1 Service layer

```mermaid
classDiagram
    direction LR
    class IKpiService {
        <<interface>>
        +GetFleetKpis(tenant, filters)
        +GetDriverKpis(tenant, user)
        +GetSafetyKpis(tenant)
        +GetFinancialKpis(tenant)
    }
    class ISaasOnboardingService {
        <<interface>>
        +BeginAsync()
        +VerifyEmailAsync()
        +ResendVerificationAsync()
        +CreatePaymentOrderAsync()
        +VerifyPaymentAsync()
        +HandleWebhookAsync()
        +RetryEmailsAsync()
        +GetProgressAsync()
        +CompleteAccountSetupAsync()
    }
    class IPdfReportService {
        <<interface>>
        +GenerateFinancialLedgerPdf()
        +GenerateFleetRoiPdf()
        +GenerateTripTurnInReceiptPdf()
    }
    class IHangfireJobs {
        <<interface>>
        +CheckExpiringLicensesAsync()
        +AuditVehicleMaintenanceSchedulesAsync()
        +ReconcilePendingTripsAsync()
        +RecalculateSafetyScoresAsync()
    }
    class ITransitOpsClient {
        <<SignalR client contract>>
        +ReceiveTripDispatched()
        +ReceiveTripCompleted()
        +ReceiveVehicleStatusChanged()
        +ReceiveDriverStatusChanged()
        +ReceiveMaintenanceUpdated()
        +ReceiveExpenseUpdated()
        +ReceiveNotification()
    }
    class ISafetyScoreService {
        <<interface>>
        +GetBreakdownAsync(tenant, driverId)
        +RecalculateAsync(driverId)
        +RecalculateAllAsync(tenant?)
    }
    class SafetyScoreCalculator {
        <<static>>
        +Calculate(input, today) SafetyScoreResult
    }
    class IndianRegulatoryFormats {
        <<static>>
        +TryNormalizeRegistration()
        +TryNormalizeLicence()
    }
    ISafetyScoreService <|.. SafetyScoreService
    SafetyScoreService --> SafetyScoreCalculator
    SafetyScoreService --> TransitOpsDbContext
    IKpiService <|.. KpiService
    ISaasOnboardingService <|.. SaasOnboardingService
    IPdfReportService <|.. QuestPdfReportService
    IHangfireJobs <|.. HangfireJobs
    TransitOpsHub ..> ITransitOpsClient : Hub~ITransitOpsClient~
    KpiService --> TransitOpsDbContext
    SaasOnboardingService --> TransitOpsDbContext
    HangfireJobs --> TransitOpsDbContext
```
