# 6. Sequence Diagrams

## 6.1 Login (JWT in HttpOnly cookie)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as React SPA
    participant API as AuthController
    participant ID as ASP.NET Identity
    participant DB as PostgreSQL

    U->>FE: Enter email + password
    FE->>API: POST /api/auth/login
    Note over API: rate limit policy "auth" (per IP)
    API->>ID: CheckPasswordSignInAsync(lockoutOnFailure)
    ID->>DB: find user, verify hash
    alt valid
        ID-->>API: Succeeded
        API->>API: build JWT (sub, role, tenant_id), 30 min
        API-->>FE: 200 + Set-Cookie transitops_access (HttpOnly, SameSite)
        FE->>API: GET /api/auth/me
        API-->>FE: user profile + role
        FE->>FE: route to role dashboard, open SignalR
    else invalid / locked (5 fails → 15 min)
        API-->>FE: 401 generic "Invalid credentials"
    end
```

## 6.2 Create and dispatch a trip

```mermaid
sequenceDiagram
    autonumber
    actor FM as Fleet Manager
    participant FE as React SPA
    participant T as TripsController
    participant V as FluentValidation
    participant DB as PostgreSQL
    participant H as TransitOpsHub
    actor OTHERS as Other users in tenant

    FM->>FE: Fill Create Trip form
    FE->>T: POST /api/trips
    T->>V: Validate CreateTripRequest
    T->>DB: load Vehicle + Driver (same tenant)
    alt cargo > capacity / driver grounded / vehicle not Available
        T-->>FE: 400 / 422 with reason
    else ok
        T->>DB: INSERT Trip (Draft)
        T-->>FE: 201 Created
    end

    FM->>FE: Click Dispatch
    FE->>T: POST /api/trips/{id}/dispatch
    T->>DB: BEGIN (Serializable)
    T->>DB: reload trip + vehicle + driver
    T->>T: re-check licence, status, capacity
    T->>DB: Trip=Dispatched, Vehicle=OnTrip, Driver=OnTrip
    T->>DB: COMMIT
    T->>H: ReceiveTripDispatched → group tenant_{id}
    H-->>OTHERS: live update
    T-->>FE: 200 trip
```

## 6.3 Complete a trip (Driver or Fleet Manager)

```mermaid
sequenceDiagram
    autonumber
    actor D as Driver
    participant FE as React SPA
    participant T as TripsController
    participant DB as PostgreSQL
    participant H as TransitOpsHub

    D->>FE: Enter final odometer + fuel litres
    FE->>T: POST /api/trips/{id}/complete
    T->>DB: BEGIN (Serializable), load trip
    alt Driver not linked to this trip
        T-->>FE: 403 Forbidden
    else trip not Dispatched / odometer ≤ current
        T-->>FE: 400
    else ok
        T->>DB: Trip=Completed, odometer, fuel
        T->>DB: Vehicle=Available, odometer, revenue += trip.revenue
        T->>DB: Driver=Available, TotalTripsCompleted++
        T->>DB: INSERT Fuel expense (litres × ₹105)
        T->>DB: recalculate driver safety score
        T->>DB: COMMIT
        T->>H: ReceiveTripCompleted
        T-->>FE: 200
    end
```

## 6.4 Maintenance work order

```mermaid
sequenceDiagram
    autonumber
    actor FM as Fleet Manager
    participant M as MaintenanceController
    participant DB as PostgreSQL
    participant H as TransitOpsHub

    FM->>M: POST /api/maintenance
    M->>DB: load vehicle
    alt OnTrip / Retired / already InShop
        M-->>FM: 409 Conflict
    else
        M->>DB: INSERT record (Active), Vehicle=InShop
        M->>H: ReceiveMaintenanceUpdated
        M-->>FM: 201
    end
    FM->>M: POST /api/maintenance/{id}/close
    M->>DB: record=Completed, final cost
    M->>DB: any other Active record for vehicle?
    alt none
        M->>DB: Vehicle=Available
    end
    M->>H: ReceiveMaintenanceUpdated
    M-->>FM: 200
```

## 6.5 SaaS purchase → payment → receipt email → admin setup

```mermaid
sequenceDiagram
    autonumber
    actor P as Purchaser
    participant FE as React SPA
    participant O as OnboardingController
    participant S as SaasOnboardingService
    participant DB as PostgreSQL
    participant R as Razorpay
    participant Q as QuestPDF
    participant M as Gmail SMTP

    P->>FE: Choose plan, enter org/name/email
    FE->>O: POST /onboarding/begin
    O->>S: BeginAsync
    S->>DB: INSERT SaasPurchase (AwaitingEmailVerification)
    S->>M: send 6-digit verification code
    P->>FE: enter code
    FE->>O: POST /onboarding/verify-email
    FE->>O: POST /onboarding/orders
    S->>R: create order (amount from server plan catalog)
    R-->>S: order_id
    O-->>FE: order_id + key_id
    FE->>R: Razorpay Checkout (test card)
    R-->>FE: payment_id + signature
    FE->>O: POST /onboarding/verify-payment
    S->>S: verify HMAC signature
    S->>R: fetch payment (order, amount, INR, captured)
    S->>DB: BEGIN: Organization + Subscription, Purchase=Paid, COMMIT
    S->>Q: SubscriptionReceiptPdf.Generate (A4, IST, amount in words)
    S->>M: HTML receipt email + PDF attachment
    S->>M: separate email with 48h setup link
    R--)O: webhook payment.captured (idempotent via EventId)
    P->>FE: open setup link, choose password
    FE->>O: POST /onboarding/complete-account-setup
    S->>DB: create ApplicationUser role=OrganizationAdmin
```

## 6.6 Report export (CSV / PDF)

```mermaid
sequenceDiagram
    autonumber
    actor FA as Financial Analyst
    participant R as ReportsController
    participant DB as PostgreSQL
    participant C as CsvHelperService
    participant Q as QuestPdfReportService

    FA->>R: GET /api/reports/export/csv/trips
    R->>DB: trips for tenant (+ financial fields by role)
    R->>C: write CSV
    R-->>FA: text/csv file
    FA->>R: GET /api/reports/export/pdf/ledger
    R->>DB: completed trips, OPEX, revenue
    R->>Q: GenerateFinancialLedgerPdf
    R-->>FA: application/pdf file
```

## 6.7 Background job: daily licence-expiry check

```mermaid
sequenceDiagram
    autonumber
    participant HF as Hangfire server
    participant J as HangfireJobs
    participant DB as PostgreSQL
    HF->>J: CheckExpiringLicensesAsync (Cron.Daily 02:00 UTC)
    J->>DB: drivers with expiry ≤ today + 30 days
    loop each driver
        alt expired and not Suspended
            J->>DB: Status = Suspended
        else expiring within 30 days
            J->>J: log warning
        end
    end
    J->>DB: SaveChanges
```
