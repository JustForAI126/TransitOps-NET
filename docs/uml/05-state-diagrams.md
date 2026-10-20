# 5. State Machine Diagrams

These are the status transitions the API actually performs (`TripsController`, `MaintenanceController`,
`VehiclesController`, `DriversController`, `HangfireJobs`, `SaasOnboardingService`).

## 5.1 Trip lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : POST /trips (FM)<br/>checks capacity, driver licence/status, vehicle Available
    Draft --> Dispatched : POST /trips/{id}/dispatch (FM)<br/>serializable tx, re-checks everything
    Draft --> Cancelled : POST /trips/{id}/cancel (FM)
    Dispatched --> Completed : POST /trips/{id}/complete (FM or own Driver)<br/>final odometer > current, fuel ≥ 0
    Dispatched --> Cancelled : POST /trips/{id}/cancel (FM)<br/>vehicle & driver released
    Completed --> [*]
    Cancelled --> [*]
```

## 5.2 Vehicle status

```mermaid
stateDiagram-v2
    [*] --> Available : vehicle created
    Available --> OnTrip : trip dispatched
    OnTrip --> Available : trip completed
    OnTrip --> Available : dispatched trip cancelled<br/>(no active maintenance)
    OnTrip --> InShop : dispatched trip cancelled<br/>(active maintenance exists)
    Available --> InShop : maintenance work order opened
    InShop --> Available : last active work order closed
    Available --> Retired : DELETE /vehicles/{id} (soft delete)
    InShop --> Retired : blocked while maintenance active
    Retired --> [*]

    note right of OnTrip
        Cannot enter maintenance
        or be retired while OnTrip
    end note
```

## 5.3 Driver status

```mermaid
stateDiagram-v2
    [*] --> Available : driver created
    Available --> OnTrip : trip dispatched
    OnDuty --> OnTrip : trip dispatched
    OnTrip --> Available : trip completed / cancelled
    Available --> OnDuty : manual status update
    OnDuty --> Available : manual status update
    Available --> OffDuty : manual status update
    OffDuty --> Available : manual status update
    Available --> Suspended : toggle-suspension (FM / Safety)<br/>or Hangfire job - licence expired
    OnDuty --> Suspended : toggle-suspension or licence expired
    OffDuty --> Suspended : licence expired (Hangfire job, daily 2 AM UTC)
    Suspended --> Available : toggle-suspension (licence must be valid)

    note left of OnTrip
        Manual status changes and suspension
        are rejected while a trip is Dispatched
    end note

    note right of Suspended
        Eligible for a trip only when
        status is Available or OnDuty
        AND licence expiry ≥ today
    end note
```

## 5.4 Maintenance work order

```mermaid
stateDiagram-v2
    [*] --> Active : POST /maintenance (FM)<br/>vehicle → InShop
    Active --> Completed : POST /maintenance/{id}/close (FM)<br/>optional final cost + notes
    Completed --> [*]
```

## 5.5 SaaS purchase (onboarding)

```mermaid
stateDiagram-v2
    [*] --> AwaitingEmailVerification : POST /onboarding/begin<br/>code emailed via SMTP
    AwaitingEmailVerification --> AwaitingEmailVerification : resend-verification
    AwaitingEmailVerification --> EmailVerified : verify-email (code OK)
    EmailVerified --> AwaitingPayment : POST /onboarding/orders<br/>Razorpay order created
    AwaitingPayment --> Paid : verify-payment OR webhook payment.captured<br/>signature + amount + status checked
    AwaitingPayment --> AwaitingPayment : payment.failed / cancelled
    Paid --> Paid : retry-emails (receipt + setup link)
    Paid --> SetupCompleted : complete-account-setup<br/>OrganizationAdmin created
    SetupCompleted --> [*]
```
