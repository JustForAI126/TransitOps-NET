# 1. Use Case Diagrams

One diagram per actor, taken from the `[Authorize(Roles = ...)]` attributes on the API controllers and the role
dashboards in the frontend. Every operational actor also signs in and out and receives live SignalR updates;
those common use cases are shown once, in 1.0.
There is **no separate Dispatcher role**: creating, dispatching and cancelling trips is a Fleet Manager action.

Notation: `«include»` means the use case always performs the included one; `«extend»` means it happens only
in some cases. System actors (Razorpay, Gmail SMTP, Hangfire scheduler) are shown on the right.

## 1.0 Common to every signed-in user

```mermaid
flowchart LR
    U(["👤 Any signed-in user<br/>(Org Admin, Fleet Manager, Driver,<br/>Safety Officer, Financial Analyst)"])
    subgraph SYS["TransitOps"]
        direction TB
        C1(["Sign in with email and password"])
        C2(["Sign out"])
        C3(["Switch light / dark theme"])
        C4(["Receive live updates (SignalR)"])
        C5(["See only own organization's data"])
    end
    U --- C1 & C2 & C3 & C4
    C1 -. "«include»" .-> C5
```

## 1.1 Fleet Manager

```mermaid
flowchart LR
    FM(["👤 Fleet Manager"])
    SMTP(["⚙️ Gmail SMTP"])

    subgraph SYS["TransitOps"]
        direction TB
        F1(["View fleet dashboard KPIs<br/>(utilization, active trips, in shop)"])
        F2(["Register vehicle"])
        F2a(["Validate Indian registration<br/>(MH-12-AB-1234 / 22-BH-1234-AA)"])
        F3(["Edit vehicle details"])
        F4(["Retire vehicle"])
        F5(["Open maintenance work order"])
        F6(["Close maintenance work order"])
        F7(["Add driver"])
        F7a(["Validate Sarathi licence,<br/>class and expiry"])
        F8(["Edit driver / suspend / reinstate"])
        F9(["Record safety incident"])
        F10(["View safety-score breakdown"])
        F11(["Send licence reminder email"])
        F12(["Create trip"])
        F12a(["Check cargo ≤ vehicle capacity"])
        F12b(["Check driver licence and status"])
        F13(["Dispatch trip"])
        F14(["Complete trip<br/>(final odometer, fuel)"])
        F14a(["Record fuel expense"])
        F14b(["Recalculate driver safety score"])
        F15(["Cancel trip"])
        F16(["Record / delete expenses"])
        F17(["Export trips CSV"])
        F18(["Download fleet ROI PDF"])
        F19(["Download trip receipt PDF"])
        F20(["View reports and analytics"])
    end

    FM --- F1 & F2 & F3 & F4 & F5 & F6 & F7 & F8 & F9 & F10 & F11 & F12 & F13 & F14 & F15 & F16 & F17 & F18 & F19 & F20
    F2 -. "«include»" .-> F2a
    F7 -. "«include»" .-> F7a
    F12 -. "«include»" .-> F12a
    F12 -. "«include»" .-> F12b
    F13 -. "«include»" .-> F12a
    F13 -. "«include»" .-> F12b
    F14 -. "«include»" .-> F14a
    F14 -. "«include»" .-> F14b
    F9 -. "«include»" .-> F14b
    F11 --- SMTP
```

## 1.2 Driver

```mermaid
flowchart LR
    DR(["👤 Driver"])
    SMTP(["⚙️ Gmail SMTP"])

    subgraph SYS["TransitOps"]
        direction TB
        D1(["View own dashboard<br/>(pending, active, completed trips)"])
        D2(["View vehicles<br/>(no cost or revenue figures)"])
        D3(["View own assigned trips"])
        D4(["Complete own dispatched trip<br/>(final odometer, fuel)"])
        D4a(["Record fuel expense"])
        D4b(["Recalculate own safety score"])
        D5(["Download own trip receipt PDF"])
        D6(["Receive licence renewal reminder"])
    end

    DR --- D1 & D2 & D3 & D4 & D5 & D6
    D4 -. "«include»" .-> D4a
    D4 -. "«include»" .-> D4b
    SMTP --- D6
```

A Driver cannot create, dispatch or cancel trips, and cannot see other drivers' trips; the API checks the
linked driver profile on every trip request.

## 1.3 Safety Officer

```mermaid
flowchart LR
    SO(["👤 Safety Officer"])
    SMTP(["⚙️ Gmail SMTP"])
    HF(["⏱️ Hangfire scheduler"])

    subgraph SYS["TransitOps"]
        direction TB
        S1(["View safety dashboard<br/>(expired, expiring, suspended, average score)"])
        S2(["View driver compliance list"])
        S3(["Edit driver details"])
        S4(["Suspend / reinstate driver"])
        S4a(["Reject reinstating an<br/>expired licence"])
        S5(["Record safety incident"])
        S6(["View safety-score breakdown"])
        S7(["Send licence reminder email"])
        S8(["Export compliance list (CSV)"])
        S9(["View maintenance records"])
        S10(["View vehicles<br/>(no cost or revenue figures)"])
        S11(["Recalculate safety scores"])
        S12(["Auto-suspend expired licences (daily)"])
    end

    SO --- S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9 & S10
    S4 -. "«extend»" .-> S4a
    S5 -. "«include»" .-> S11
    S7 --- SMTP
    HF --- S11 & S12
```

## 1.4 Financial Analyst

```mermaid
flowchart LR
    FA(["👤 Financial Analyst"])

    subgraph SYS["TransitOps"]
        direction TB
        A1(["View financial dashboard<br/>(OPEX, revenue, net profit, margin, cost/km)"])
        A2(["View vehicles with acquisition cost and revenue"])
        A3(["View trips with revenue"])
        A4(["View maintenance costs"])
        A5(["Record expense<br/>(fuel, toll, permit, insurance, other)"])
        A5a(["Validate amount, litres,<br/>vehicle and trip"])
        A6(["Delete expense"])
        A7(["View analytics<br/>(fuel efficiency, vehicle ROI)"])
        A8(["Export trips CSV"])
        A9(["Download financial ledger PDF"])
    end

    FA --- A1 & A2 & A3 & A4 & A5 & A6 & A7 & A8 & A9
    A5 -. "«include»" .-> A5a
```

## 1.5 Organization Admin

The Organization Admin is the customer who buys TransitOps. They first purchase a plan, then manage their
organization's user accounts. They do not run day-to-day fleet operations.

```mermaid
flowchart LR
    OA(["👤 Organization Admin<br/>(purchaser before setup)"])
    RZP(["⚙️ Razorpay"])
    SMTP(["⚙️ Gmail SMTP"])

    subgraph BUY["TransitOps – purchase and onboarding (public)"]
        direction TB
        P1(["Browse subscription plans"])
        P2(["Start purchase<br/>(organization, name, email)"])
        P3(["Verify email with 6-digit code"])
        P4(["Pay for plan (Razorpay Checkout)"])
        P4a(["Verify payment signature<br/>and captured amount"])
        P5(["Receive payment receipt PDF"])
        P6(["Set up admin account<br/>via single-use link"])
        P7(["Resend receipt / setup email"])
    end

    subgraph ADMIN["TransitOps – organization administration"]
        direction TB
        O1(["List organization users"])
        O2(["Create user account"])
        O2a(["Assign role: Fleet Manager, Driver,<br/>Safety Officer or Financial Analyst"])
        O2b(["Enter licence details and<br/>create linked driver profile"])
        O3(["Edit user / change role"])
        O4(["Delete user<br/>(revoke sign-in, keep history)"])
    end

    OA --- P1 & P2 & P3 & P4 & P6 & P7
    OA --- O1 & O2 & O3 & O4
    P2 -. "«include»" .-> P3
    P4 -. "«include»" .-> P4a
    P4 -. "«include»" .-> P5
    P7 -. "«extend»" .-> P5
    O2 -. "«include»" .-> O2a
    O2 -. "«extend»" .-> O2b
    O3 -. "«extend»" .-> O2b
    P3 --- SMTP
    P5 --- SMTP
    P6 --- SMTP
    P4 --- RZP
```

The admin role can only be created by this purchase flow. An Organization Admin cannot create another
Organization Admin, and nobody can promote themselves to one.

## 1.6 Permission matrix (summary)

| Resource / action | Org Admin | Fleet Manager | Driver | Safety Officer | Financial Analyst |
|---|:-:|:-:|:-:|:-:|:-:|
| Vehicles – view | – | ✅ | ✅ (no financials) | ✅ (no financials) | ✅ |
| Vehicles – create / update / retire | – | ✅ | – | – | – |
| Drivers – view | – | ✅ | – | ✅ | – |
| Drivers – create | – | ✅ | – | – | – |
| Drivers – update / suspend / remind | – | ✅ | – | ✅ | – |
| Drivers – record incident / score breakdown | – | ✅ | – | ✅ | – |
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
| Organization users admin | ✅ | – | – | – | – |
