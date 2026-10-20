# 1. Use Case Diagrams

Actors and what each one can do, taken from the `[Authorize(Roles = ...)]` attributes on the API controllers.
There is **no separate Dispatcher role**: creating, dispatching and cancelling trips is a Fleet Manager action.

## 1.1 Operational roles

```mermaid
flowchart LR
    FM(["👤 Fleet Manager"])
    DR(["👤 Driver"])
    SO(["👤 Safety Officer"])
    FA(["👤 Financial Analyst"])

    subgraph SYS["TransitOps system"]
        direction TB
        UC1(["Log in / Log out"])
        UC2(["View fleet dashboard KPIs"])
        UC3(["Manage vehicles: add, edit, retire"])
        UC4(["View vehicles"])
        UC5(["Manage drivers: add"])
        UC6(["Edit driver / suspend / send licence reminder"])
        UC7(["Create, dispatch, cancel trips"])
        UC8(["Complete trip: odometer + fuel"])
        UC9(["View trips"])
        UC10(["Open / close maintenance work orders"])
        UC11(["View maintenance"])
        UC12(["Record / delete expenses"])
        UC13(["Export trips CSV"])
        UC14(["Download financial ledger PDF"])
        UC15(["Download fleet ROI PDF"])
        UC16(["Download trip turn-in receipt PDF"])
        UC17(["View safety KPIs"])
        UC18(["View financial KPIs"])
        UC19(["View own driver KPIs"])
        UC20(["Receive live updates via SignalR"])
        UC21(["Hangfire dashboard"])
    end

    FM --- UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11 & UC12 & UC13 & UC15 & UC16 & UC20 & UC21
    DR --- UC1 & UC4 & UC19 & UC20
    DR -. "own assigned trips only" .- UC8
    DR -. "own assigned trips only" .- UC9
    DR -. "own assigned trips only" .- UC16
    SO --- UC1 & UC4 & UC6 & UC11 & UC17 & UC20
    FA --- UC1 & UC4 & UC9 & UC11 & UC12 & UC13 & UC14 & UC18 & UC20
```

## 1.2 SaaS purchase and administration

```mermaid
flowchart LR
    BUY(["👤 Purchaser - anonymous"])
    OA(["👤 Organization Admin"])
    RZP(["⚙️ Razorpay"])
    SMTP(["⚙️ Gmail SMTP"])
    HF(["⏱️ Hangfire scheduler"])

    subgraph SYS["TransitOps system"]
        direction TB
        P1(["Browse subscription plans"])
        P2(["Begin purchase + verify email code"])
        P3(["Pay for plan - Razorpay checkout"])
        P4(["Receive payment receipt email"])
        P5(["Set up admin account via one-time link"])
        A1(["List / create / edit / delete org users"])
        A2(["Assign role: FM, Driver, Safety, Analyst"])
        J1(["Daily licence-expiry check + auto-suspend"])
    end

    BUY --- P1 & P2 & P3 & P5
    P3 --- RZP
    P2 --- SMTP
    P4 --- SMTP
    P3 -. "includes" .-> P4
    OA --- A1
    A1 -. "includes" .-> A2
    HF --- J1
```

## 1.3 Permission matrix (summary)

| Resource / action | Org Admin | Fleet Manager | Driver | Safety Officer | Financial Analyst |
|---|:-:|:-:|:-:|:-:|:-:|
| Vehicles – view | – | ✅ | ✅ (no financials) | ✅ (no financials) | ✅ |
| Vehicles – create / update / retire | – | ✅ | – | – | – |
| Drivers – view | – | ✅ | – | ✅ | – |
| Drivers – create | – | ✅ | – | – | – |
| Drivers – update / suspend / remind | – | ✅ | – | ✅ | – |
| Trips – view | – | ✅ | own only | – | ✅ |
| Trips – create / dispatch / cancel | – | ✅ | – | – | – |
| Trips – complete | – | ✅ | own only | – | – |
| Maintenance – view | – | ✅ | – | ✅ | ✅ |
| Maintenance – create / close | – | ✅ | – | – | – |
| Expenses – view / create / delete | – | ✅ | – | – | ✅ |
| CSV trip export | – | ✅ | – | – | ✅ |
| Ledger PDF | – | – | – | – | ✅ |
| Fleet ROI PDF | – | ✅ | – | – | – |
| Trip receipt PDF | – | ✅ | own only | – | – |
| Org users admin | ✅ | – | – | – | – |
