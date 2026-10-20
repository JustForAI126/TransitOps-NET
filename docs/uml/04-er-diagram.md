# 4. Entity-Relationship Diagram (PostgreSQL)

Based on `TransitOpsDbContext.cs`. Deletes from Vehicle/Driver to Trip are `Restrict`, so history is never cascaded away.
Vehicles are "deleted" by setting status `Retired`.

```mermaid
erDiagram
    ORGANIZATION ||--o{ ORGANIZATION_SUBSCRIPTION : "has (restrict delete)"
    ORGANIZATION ||--o{ ASPNET_USERS : "tenant_id"
    SAAS_PURCHASE |o--o| ORGANIZATION : "provisions"
    ASPNET_USERS |o--o| DRIVER : "identity_user_id"
    ASPNET_USERS ||--o{ ASPNET_USER_ROLES : ""
    ASPNET_ROLES ||--o{ ASPNET_USER_ROLES : ""
    VEHICLE ||--o{ VEHICLE_DOCUMENT : "cascade"
    VEHICLE ||--o{ TRIP : "restrict"
    DRIVER ||--o{ TRIP : "restrict"
    VEHICLE ||--o{ MAINTENANCE_RECORD : ""
    VEHICLE |o--o{ EXPENSE_RECORD : ""
    TRIP |o--o{ EXPENSE_RECORD : ""

    ORGANIZATION {
        text tenant_id PK
        text name
        text normalized_billing_email UK
    }
    ORGANIZATION_SUBSCRIPTION {
        uuid id PK
        text tenant_id FK
        text plan_id
        bigint amount_paise
        int term_months
        timestamptz starts_at_utc
        timestamptz ends_at_utc
        text status
        text razorpay_order_id UK
        text razorpay_payment_id UK
    }
    SAAS_PURCHASE {
        uuid id PK
        text email
        text payment_status
        text razorpay_order_id UK
        text razorpay_payment_id UK
        text setup_token_hash UK
        text tenant_id
    }
    RAZORPAY_WEBHOOK_RECEIPT {
        bigint id PK
        text event_id UK
    }
    ASPNET_USERS {
        text id PK
        text email
        text full_name
        int role
        text tenant_id
        bool is_demo_account
    }
    ASPNET_ROLES {
        text id PK
        text name
    }
    ASPNET_USER_ROLES {
        text user_id FK
        text role_id FK
    }
    VEHICLE {
        uuid id PK
        text tenant_id
        text registration_number UK
        text name
        text model
        int type
        int max_capacity_kg
        int current_odometer_km
        numeric acquisition_cost
        int status
        text region
        numeric revenue_generated
    }
    VEHICLE_DOCUMENT {
        uuid id PK
        uuid vehicle_id FK
        text type
        timestamp expiry_date
    }
    DRIVER {
        uuid id PK
        text tenant_id
        text identity_user_id UK
        text name
        text email UK
        text contact_number
        text license_number UK
        text license_category
        date license_expiry_date
        int safety_score
        int status
        int incident_history_count
        int total_trips_completed
    }
    TRIP {
        uuid id PK
        text tenant_id
        text trip_code UK
        uuid vehicle_id FK "unique while active"
        uuid driver_id FK "unique while active"
        text source
        text destination
        int cargo_weight_kg
        int planned_distance_km
        int final_odometer_km
        numeric fuel_consumed_liters
        numeric revenue
        int status
    }
    MAINTENANCE_RECORD {
        uuid id PK
        text tenant_id
        uuid vehicle_id FK
        text service_type
        numeric cost
        int status
        timestamp start_date
        timestamp completed_date
    }
    EXPENSE_RECORD {
        uuid id PK
        text tenant_id
        uuid vehicle_id FK
        uuid trip_id FK
        int type
        numeric amount
        numeric liters
        timestamp expense_date
    }
```
