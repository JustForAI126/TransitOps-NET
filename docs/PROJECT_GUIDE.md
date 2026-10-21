# TransitOps – complete project guide (for the presentation and viva)

Read this top to bottom once, then use the module sections and the viva questions to revise.
Open it in VS Code with **Ctrl + Shift + V** for a formatted view.

---

## 1. What TransitOps is, in one minute

TransitOps is a **web application for transport (logistics) companies in India**. A company that owns trucks
and vans uses it to run daily operations:

- keep a list of **vehicles** and **drivers** (with Indian registration and licence checks),
- plan and dispatch **trips** (which truck, which driver, how much cargo, from where to where),
- send vehicles for **maintenance**,
- record **fuel and other expenses**,
- track **driver safety** (licence expiry, incidents, a calculated safety score),
- see **dashboards and reports** (utilisation, costs, profit, ROI) and download **PDF/CSV** files.

It is sold as **SaaS** (Software as a Service): a company buys a monthly plan online, pays through
**Razorpay**, receives a **PDF receipt by email**, and gets its own private workspace. Each company only ever
sees its own data (**multi-tenancy**).

### Who uses it (actors / roles)

| Role | Main job in the app |
|---|---|
| **Organization Admin** | The customer who bought the plan. Creates user accounts for their staff and assigns roles. |
| **Fleet Manager** | Runs operations: vehicles, drivers, trips, maintenance, expenses, reports. |
| **Driver** | Sees and completes **their own** trips only. |
| **Safety Officer** | Watches driver compliance: licences, suspensions, incidents, safety scores. |
| **Financial Analyst** | Watches money: expenses, revenue, profit, ROI, financial PDF. |

There is no separate "Dispatcher": dispatching trips is a Fleet Manager action.

---

## 2. The big picture – what happens when you click something

```
 Browser (React app)  ──HTTP──▶  Express dev server (port 3000) ──proxy──▶  ASP.NET Core API (port 5000)
        ▲                                                                       │
        │                                                                       ├─▶ EF Core ─▶ PostgreSQL (Supabase)
        │                                                                       ├─▶ QuestPDF / CsvHelper (files)
        └──────────── SignalR (live updates over WebSocket) ◀───────────────────┤
                                                                                ├─▶ Gmail / Brevo (emails)
                                                                                ├─▶ Razorpay (payments)
                                                                                └─▶ Hangfire (daily background jobs)
```

**Example: a Fleet Manager dispatches a trip**

1. The manager clicks **Dispatch** in the React page.
2. React calls `POST /api/trips/{id}/dispatch` through `services/api.ts`. The login cookie travels with it.
3. The API checks the cookie (JWT) and the role: only a Fleet Manager may dispatch.
4. `TripsController` opens a **database transaction**, re-checks the rules (driver licence valid, vehicle
   available, cargo ≤ capacity) and marks trip = Dispatched, vehicle = On Trip, driver = On Trip, all
   together.
5. EF Core saves the changes to PostgreSQL.
6. The API sends a **SignalR** message to everyone in that company, so other open dashboards update
   instantly without refreshing.
7. React shows a success message and the new statuses.

Every feature follows this same pattern: **React page → API controller → rules/validation → database → reply
(+ live update)**.

In the deployed version there is no Express server: the API serves the built React files itself, so the
whole app is one website on one address.

---

## 3. Tools used, what they do, and why

### Frontend (what the user sees)

| Tool | What it is | Why we used it | Where |
|---|---|---|---|
| **React 19** | JavaScript library for building user interfaces from reusable **components** | Industry standard; the UI updates automatically when data changes | `frontend/src/components` |
| **TypeScript** | JavaScript with types | Catches mistakes before running (e.g. wrong field name) | every `.ts/.tsx` file |
| **Vite** | Build tool and dev server | Very fast reloads during development; builds the final files | `frontend/vite.config.ts` |
| **Tailwind CSS 4** | CSS written as small class names (`text-sm`, `rounded-xl`) | Fast, consistent styling; light/dark theme | class names in components |
| **SignalR client** | Keeps a live connection to the API | Live updates (trip dispatched, maintenance changed) without refresh | `services/signalr.ts` |
| **lucide-react** | Icon library | Clean icons | imports in components |
| **motion** | Animation library | Small UI animations | a few components |
| **Express** (dev only) | Small Node.js web server | Serves the React app locally and forwards `/api` and `/hubs` to the .NET API | `frontend/server.ts` |

### Backend (the server and rules)

| Tool | What it is | Why we used it | Where |
|---|---|---|---|
| **ASP.NET Core Web API (.NET 10, C#)** | Microsoft's framework for web APIs | Fast, secure, strongly typed, great tooling | `backend/TransitOps.Api` |
| **Entity Framework Core** | ORM: maps C# classes to database tables | Write C# instead of raw SQL; migrations for schema changes | `TransitOpsDbContext.cs`, `Migrations/` |
| **Npgsql** | PostgreSQL driver for .NET | Lets EF Core talk to PostgreSQL | `Program.cs` |
| **ASP.NET Core Identity** | Built-in user system | Secure password hashing, lockout, user/role storage | `AuthController`, `ApplicationUser` |
| **JWT (JSON Web Token)** | Signed login token | Stateless login; stored in an **HttpOnly cookie** so JavaScript can't steal it | `AuthController.cs` |
| **RBAC** | Role-Based Access Control | Each endpoint says which roles may use it | `[Authorize(Roles = "...")]` on controllers |
| **FluentValidation** | Validation rules written as C# classes | Clear, testable rules (e.g. Indian licence format) | `Application/Validators` |
| **SignalR** | Real-time messaging over WebSockets | Push live updates to dashboards | `Hubs/TransitOpsHub.cs` |
| **Hangfire** | Background job scheduler | Run daily jobs (licence check, safety scores) without a person | `BackgroundJobs/HangfireJobs.cs`, `Startup/RecurringJobs.cs` |
| **QuestPDF** | PDF generation in C# | Professional PDFs: receipts, ledger, ROI report | `Application/Reports` |
| **CsvHelper** | CSV file writing | Excel-friendly trip export with correct escaping | `CsvHelperService.cs` |
| **Swagger** | Auto-generated API documentation page | Try every endpoint in the browser at `/swagger` (Development only) | `Program.cs` |
| **xUnit** | .NET test framework | 68 automated unit tests | `backend/TransitOps.Tests` |

### Data, services and delivery

| Tool | What it is | Why |
|---|---|---|
| **PostgreSQL** | Relational database | Reliable, free, supports transactions and advanced indexes |
| **Supabase** | Hosted PostgreSQL in the cloud (Mumbai) | No database server to manage; free tier |
| **Razorpay (Test Mode)** | Indian payment gateway | Card/UPI/netbanking checkout; test mode moves no real money |
| **MailKit + Gmail SMTP / Brevo** | Email sending library and mail servers | Verification codes, receipts with PDF, licence reminders. MailKit replaced .NET's old `SmtpClient`, which could not log in to Brevo |
| **Git + GitHub** | Version control and code hosting | History of every change, teamwork |
| **GitHub Actions (CI)** | Automatic checks on every push | Builds and tests backend, frontend and Docker image |
| **Docker** | Packages the app into one container | Runs the same everywhere |
| **Render** | Cloud hosting | Runs the Docker container on the internet |
| **Postman / Swagger** | API testing tools | Manual API testing |
| **VS Code / Visual Studio 2026** | Editors | Write, run (F5) and debug the code |

---

## 4. Folder tour

```
TransitOps-NET/
├── backend/                         .NET solution (TransitOps.sln) – Clean Architecture
│   ├── TransitOps.Domain/           Entities (Vehicle, Driver, Trip…) and enums (statuses, roles)
│   ├── TransitOps.Application/      DTOs, validators, PDF/CSV generators, safety score formula
│   ├── TransitOps.Infrastructure/   Database (DbContext, migrations), services, Hangfire jobs, email
│   ├── TransitOps.Api/              Controllers (endpoints), SignalR hub, Program.cs, Startup/
│   └── TransitOps.Tests/            xUnit unit tests
├── frontend/                        React app
│   └── src/
│       ├── components/views/        One screen per menu item (Vehicles, Trips, Reports…)
│       ├── components/dashboard/    One dashboard per role
│       ├── components/modals/       Pop-up forms (Add vehicle, Create trip…)
│       ├── context/AppContext.tsx   Shared app state: logged-in user, data, actions
│       ├── services/api.ts          All calls to the API
│       └── utils/indianFormats.ts   Indian registration/licence checks for forms
├── database/                        Supabase security (row-level security) scripts
├── docs/                            Guides, UML diagrams, test report, this guide
├── tests/api/                       199+ end-to-end API checks (Python)
├── tools/                           Offline test database, mail catcher, start script
├── Dockerfile, render.yaml          Deployment
└── .github/workflows/ci.yml         Automatic checks
```

**Clean Architecture (the 4 backend projects)** – like floors of a building, each only depends on the floor
below:

- **Domain** = the business things and their states. No database, no web. (Most stable.)
- **Application** = business rules that are not about storage: validation, formulas, PDF layouts.
- **Infrastructure** = how things are stored and sent: database, email, Razorpay, background jobs.
- **Api** = the doorway: HTTP endpoints, security, real-time hub, startup.

Why? Each part can change without breaking the others, and rules can be unit-tested without a database.

---

## 5. Modules explained, with viva questions

### Module 1 – Login, security and roles

**What it does:** users sign in with email and password; the app remembers them for 30 minutes and only shows
what their role allows.

**How it works:**

1. `POST /api/auth/login` – ASP.NET Identity checks the password against a **hash** (passwords are never
   stored in plain text).
2. If correct, the API creates a **JWT** (a signed token containing user id, role and company/tenant id) and
   puts it in an **HttpOnly cookie** called `transitops_access`, valid for **30 minutes**.
3. Every later request carries the cookie automatically. The API checks the signature, expiry and role.
4. **Lockout:** 5 wrong passwords → account locked for 15 minutes.
5. **Rate limit:** at most 10 login attempts per minute per computer (stops password-guessing robots).
6. **Logout** deletes the cookie.
7. **Multi-tenancy:** every record has a `TenantId`; every query filters by the user's tenant, so company A
   can never see company B's data.

**Files:** `AuthController.cs`, `Program.cs` (Identity, JWT, policies, rate limiting), `ApplicationUser`.

**Viva questions**

1. *How are passwords stored?* – As salted hashes by ASP.NET Identity, never in plain text.
2. *What is a JWT and why HttpOnly cookie instead of localStorage?* – A signed token with the user's id, role
   and tenant. In an HttpOnly cookie, JavaScript (and so an XSS attack) cannot read it.
3. *What is RBAC here?* – Each endpoint declares allowed roles, e.g. `[Authorize(Roles = "FleetManager")]`;
   others get 403 Forbidden. Hiding buttons in the UI is only convenience; the API enforces it.
4. *What is the difference between 401 and 403?* – 401 = not logged in; 403 = logged in but not allowed.
5. *How do you stop brute-force attacks?* – Lockout after 5 failures for 15 minutes plus a login rate limit
   of 10 per minute per IP.
6. *How is data separated between companies?* – Every table row has a TenantId taken from the JWT, and every
   query filters by it.
7. *Is there public sign-up?* – No. Users are created by their Organization Admin; the admin is created only
   after a verified purchase.

### Module 2 – Organization Admin and user management

**What it does:** the admin creates, edits and deletes staff accounts and gives each a role (Fleet Manager,
Driver, Safety Officer, Financial Analyst). Creating a Driver account also creates the driver profile
(licence details) and links them.

**Rules:** an admin cannot create another admin; deleting a user removes their sign-in but keeps trip history.

**Files:** `OrganizationUsersController.cs`, `OrganizationAdminDashboard.tsx`.

**Viva questions**

1. *Why can't the admin create another admin?* – The admin role is only created through the paid purchase
   flow; this prevents privilege escalation.
2. *What happens to a deleted driver's trips?* – Kept for history and reports; only sign-in is removed.
3. *Where is the role checked?* – In the API (`[Authorize(Roles = "OrganizationAdmin")]`) and in validation
   (role must be one of the four operational roles).

### Module 3 – SaaS purchase, payment and receipt

**Steps:**

1. **Choose plan** (Essential ₹2,999 / Growth ₹7,499 / Enterprise ₹19,999, one month). Prices live on the
   server (`appsettings.json`) so nobody can change the price from the browser.
2. **Enter organization, name, email** → the API emails a **6-digit code** (valid 10 minutes, stored only as
   a hash).
3. **Verify the code.**
4. **Pay**: the API creates a **Razorpay order** for the exact amount; the browser opens Razorpay Checkout.
5. After payment, the API **verifies**: (a) the HMAC-SHA256 **signature** from Razorpay, and (b) fetches the
   payment from Razorpay to confirm amount, currency (INR) and status "captured". Only then is it "Paid".
6. In one database transaction: create the **Organization** (new TenantId) and **Subscription**.
7. Email 1: **receipt** – HTML email with a **QuestPDF receipt attached** (receipt number, IST time, amount in
   words, payment and order IDs, "Test Mode" banner).
8. Email 2: **single-use account setup link** (valid 48 hours). The customer chooses their own password –
   passwords are never emailed.
9. A Razorpay **webhook** (`payment.captured`) also confirms payments, and is safe to receive twice
   (idempotent, using the event ID).

**Files:** `OnboardingController.cs`, `SaasOnboardingService.cs`, `SubscriptionReceiptPdf.cs`,
`SmtpEmailSender.cs`, `SaasOnboardingView.tsx`.

**Viva questions**

1. *How do you know a payment is genuine?* – Verify Razorpay's HMAC-SHA256 signature with our secret, then
   fetch the payment from Razorpay and check order, amount, INR and "captured".
2. *Why are prices on the server?* – So a user can't edit the amount in the browser.
3. *What is a webhook?* – Razorpay calling our API directly when a payment event happens; it works even if
   the customer closes the browser.
4. *What is idempotency?* – Processing the same event twice has no extra effect; we store webhook event IDs.
5. *Why test mode?* – No real money moves; real cards are not needed for a demo.
6. *How is the PDF made?* – QuestPDF builds it in C# (A4 layout, tables, amount in words in the Indian system),
   then it is attached to the email.
7. *Why a setup link instead of emailing a password?* – Emails can be read by others; a single-use, expiring
   link lets the user choose the password themselves.

### Module 4 – Vehicles and Indian registration validation

**What it does:** add, edit, retire vehicles; filter by status/region/search. Statuses: **Available, On Trip,
In Shop, Retired**.

**Indian registration rules** (Central Motor Vehicles Rules):

- Standard: `MH-12-AB-1234` = state code (must be a real state/UT) + RTO number + series letters + number.
- Delhi style: `DL-1C-AB-1234`. Bharat series: `22-BH-1234-AA` (from 2021, letters I/O not allowed).
- Stored in one standard form, so `mh12ab1234` and `MH-12-AB-1234` count as the **same** vehicle (duplicates
  are blocked, per company).
- Checked in the browser (instant message) **and** in the API (cannot be bypassed).

**Other rules:** capacity > 0; odometer and cost not negative; a vehicle on a trip or in maintenance cannot be
retired; "delete" means **retire** (history is kept).

**Files:** `VehiclesController.cs`, `IndianRegulatoryFormats.cs`, `Validators.cs`, `VehiclesView.tsx`,
`AddVehicleModal.tsx`, `utils/indianFormats.ts`.

**Viva questions**

1. *Explain the registration format.* – State code, RTO code, series, number, e.g. MH-12-AB-1234; BH series
   for vehicles that move between states.
2. *Why validate on both frontend and backend?* – Frontend for quick feedback; backend because a request can
   be sent without the UI.
3. *How do you prevent duplicate registrations?* – Normalise to one format and use a unique database index
   per tenant; also checked before saving.
4. *Why retire instead of delete?* – Trips, expenses and reports still refer to the vehicle.

### Module 5 – Drivers and Indian licence validation

**Licence format (Sarathi / national format):** 15 characters – state code + RTO code + issue year + 7-digit
number, e.g. `MH14 20180045921`. Issue year between 1950 and this year. **Licence class** must be an official
class (LMV, LMV-TR, MGV, HMV, HGMV, HPMV, HTV…). **Expiry** at most 20 years ahead and not before issue year.

**Statuses:** Available, On Duty, On Trip, Off Duty, Suspended. Suspended or expired-licence drivers cannot be
given trips. A suspended driver with an expired licence cannot be reinstated.

**Files:** `DriversController.cs`, `IndianRegulatoryFormats.cs`, `AddDriverModal.tsx`, `DriversView.tsx`.

**Viva questions**

1. *What does the licence number contain?* – State, RTO, year of issue and a serial number.
2. *What happens to a driver whose licence expires?* – Cannot be assigned trips; the daily job suspends them.
3. *Can a driver's status change during a trip?* – No, the API blocks it while a trip is dispatched.

### Module 6 – Trips (the core workflow)

**Life cycle:** `Draft → Dispatched → Completed`, or `Draft/Dispatched → Cancelled`.

| Step | Who | Checks | Effect |
|---|---|---|---|
| Create (Draft) | Fleet Manager | cargo ≤ vehicle capacity, driver eligible, vehicle Available | Trip saved; nothing reserved yet |
| Dispatch | Fleet Manager | all checks again **inside a transaction** | Trip, vehicle and driver → On Trip together |
| Complete | Fleet Manager or the trip's own driver | final odometer > current, fuel ≥ 0 | Trip Completed; vehicle & driver Available; fuel expense recorded (litres × ₹96.50); safety score updated |
| Cancel | Fleet Manager | not already completed/cancelled | Vehicle & driver freed |

**No double booking:** the dispatch uses a **serializable database transaction** plus **unique indexes** that
allow only one dispatched trip per vehicle and per driver. Two people pressing Dispatch at the same moment –
only one succeeds (tested).

**Files:** `TripsController.cs`, `TripsView.tsx`, `CreateTripModal.tsx`, `CompleteTripModal.tsx`.

**Viva questions**

1. *How do you prevent the same truck being sent on two trips?* – Status checks, a serializable transaction,
   and a partial unique index on dispatched trips per vehicle/driver.
2. *What is a transaction?* – A group of database changes that all succeed or all fail together.
3. *Why re-check everything at dispatch?* – Things may have changed since the draft (licence expired,
   vehicle sent to maintenance).
4. *Can a driver complete someone else's trip?* – No; the API compares the trip's driver with the logged-in
   user (403 otherwise).

### Module 7 – Maintenance

**What it does:** open a work order → vehicle becomes **In Shop** (cannot be dispatched); close it (with final
cost) → vehicle becomes **Available** again (unless another open order exists). A vehicle on a trip or
retired cannot enter maintenance; only one open work order per vehicle.

**Files:** `MaintenanceController.cs`, `MaintenanceView.tsx`, `LogMaintenanceModal.tsx`.

**Viva questions**

1. *Why can't an In Shop vehicle be dispatched?* – It is unsafe/unavailable; dispatch rejects it.
2. *Who can create maintenance?* – Fleet Manager; Safety Officer and Financial Analyst can only view.

### Module 8 – Fuel and expenses

**What it does:** record Fuel, Toll, Maintenance, Permit, Insurance or Other expenses for a vehicle/trip.
Fuel needs litres. Amounts must be positive. The vehicle and trip must match. Fleet Manager and Financial
Analyst only.

**Files:** `ExpensesController.cs`, `ExpensesView.tsx`.

### Module 9 – Safety score (calculated, not typed in)

Every driver starts at **100**, then:

| Factor | Points |
|---|---|
| Each recorded incident | −8 (maximum −40) |
| Licence expired | −25 |
| Licence expires within 30 days | −5 |
| Fuel discipline: share of recent trips (90 days) that used much more fuel than the vehicle's normal (below 85% of rated km/L) | up to −15 (needs at least 3 trips) |
| Experience | +1 per 25 completed trips (max +5) |

Result between 0 and 100. Bands: **90+ Excellent, 75–89 Good, 60–74 Needs attention, below 60 High risk**.
It updates when a trip is completed, an incident is recorded, the driver is edited, and every night.
Safety Officers click the score to see the breakdown.

**Files:** `SafetyScoreCalculator.cs`, `SafetyScoreService.cs`, `SafetyOfficerDashboard.tsx`.

**Viva questions**

1. *Why is fuel used in a safety score?* – No GPS/telematics data exists; very high fuel use is a common proxy
   for harsh acceleration and idling.
2. *Why not let managers type the score?* – A calculated score is consistent and can't be manipulated.
3. *How is it tested?* – Unit tests for every factor and the 0–100 limits.

### Module 10 – Dashboards, KPIs and reports

**Fleet KPIs:** active vehicles (On Trip), available, in maintenance, active trips (Dispatched), pending trips
(Draft), drivers on duty, and **Fleet Utilisation = On-Trip vehicles ÷ non-retired vehicles × 100**.

**Financial KPIs:** Fuel spend, Maintenance spend, Other expenses, **Total OPEX = fuel + maintenance + other**,
**Gross revenue = revenue of completed trips**, **Net profit = revenue − OPEX**, **Net margin = profit ÷ revenue
× 100**, **Cost per km = OPEX ÷ km of completed trips**.

**Vehicle ROI = (Revenue − (Maintenance + Fuel)) ÷ Acquisition cost × 100.**

**Exports:** Trips **CSV** (CsvHelper, correctly escaped), **Financial ledger PDF** (Financial Analyst),
**Fleet ROI PDF** (Fleet Manager), **Trip receipt PDF** (Fleet Manager or the trip's driver). Each role has
its own dashboard.

**Files:** `KpiService.cs`, `KpiController.cs`, `ReportsController.cs`, `QuestPdfReportService.cs`,
`CsvHelperService.cs`, the dashboards in `components/dashboard`.

**Viva questions**

1. *How is utilisation calculated? Why exclude retired vehicles?* – On-trip ÷ non-retired × 100; retired
   vehicles can never be used, so including them would make utilisation look falsely low.
2. *Explain ROI.* – Operating profit of a vehicle divided by what it cost to buy.
3. *Are dashboard numbers real?* – Yes, calculated by the API from database records (tests compare them).

### Module 11 – Real-time updates (SignalR)

When a trip is dispatched/completed, a vehicle or driver status changes, maintenance or expenses change, the
API sends a message (e.g. `ReceiveTripDispatched`) to the **group of that company** (`tenant_{id}`). Open
dashboards update immediately. Connections require login and can only join their own company's group.

**Viva:** *Why SignalR instead of refreshing?* – Instant updates and less server load than polling; it uses
WebSockets with automatic fallbacks.

### Module 12 – Background jobs (Hangfire)

| Job | When (UTC) | What it does |
|---|---|---|
| Licence expiry check | 02:00 daily | Suspends drivers whose licence expired; logs ones expiring in 30 days |
| Safety score recalculation | 02:30 daily | Recalculates every driver's score |
| Maintenance audit | 03:00 daily | Flags vehicles due for service by odometer |
| Stale draft trips | 03:30 daily | Reports draft trips older than 48 hours |

Jobs are stored in PostgreSQL, so they survive restarts. If the server was asleep, a missed job runs when it
wakes. Dashboard at `/hangfire` (Fleet Manager, Development only).

**Viva:** *Why Hangfire?* – Reliable scheduled jobs inside the .NET app with retries and a dashboard, no
separate server needed.

### Module 13 – Database (PostgreSQL + EF Core)

**Main tables:** Vehicles, VehicleDocuments, Drivers, Trips, MaintenanceRecords, Expenses, Organizations,
OrganizationSubscriptions, SaasPurchases, RazorpayWebhookReceipts, plus Identity tables (users, roles).

**Relationships:** a Vehicle has many Trips, MaintenanceRecords and Expenses; a Driver has many Trips; a Trip
has many Expenses. Deleting a vehicle/driver with trips is **restricted** (history protected).

**Important indexes:** unique registration and licence per tenant; one dispatched trip per vehicle and per
driver; unique trip code; unique Razorpay IDs. Money columns are `numeric(18,2)`.

**Migrations** (EF Core) record schema changes so every database can be upgraded safely. On startup,
`DatabaseInitializer` creates tables on an empty database, applies migrations and creates indexes; demo data
is seeded by `DemoDataSeeder`.

**Viva questions**

1. *What is an ORM?* – It maps classes to tables so we work with C# objects instead of SQL strings.
2. *What is a migration?* – A versioned script for a schema change, applied in order.
3. *Why PostgreSQL?* – Free, reliable, transactions, partial/expression indexes, works with Supabase.
4. *What is a foreign key?* – A column that must point to an existing row in another table (e.g.
   Trip.VehicleId → Vehicles).

### Module 14 – Validation

Two layers: **frontend** (instant messages in forms, `indianFormats.ts`) and **backend** (FluentValidation
classes in `Validators.cs` plus checks in controllers). The backend is the real guard. Errors come back as a
standard JSON "problem" response that the forms display.

### Module 15 – Testing and quality

- **68 unit tests** (xUnit): Indian formats, safety score formula, receipt PDF.
- **201 end-to-end API checks** (`tests/api/checklist.py`) following the test checklist: login, all role
  permissions, KPIs, vehicles, drivers, trips (including two dispatches at the same time), maintenance,
  expenses, reports, database constraints, errors, demo data. Run on a separate local test database.
- **CI (GitHub Actions)**: every push builds and tests the backend, type-checks and builds the frontend and
  builds the Docker image.
- Results: `docs/TEST_REPORT.md`.

**Viva:** *Unit test vs end-to-end test?* – A unit test checks one piece of code alone (e.g. the safety
formula); an end-to-end test calls the running API like a real user.

### Module 16 – Deployment

The **Dockerfile** builds the React app and the .NET API into **one container**; the API serves the React
files, so the website, API and live updates share one address (no cross-site cookie problems). **Render**
runs the container; **Supabase** hosts the database; **Brevo** sends email (Render's free plan blocks Gmail's
port). Secrets (database password, keys) are stored as Render environment variables, never in GitHub.

**Live site:** https://transitops-s0vg.onrender.com (Render free plan, Singapore; database: the project's Supabase in Mumbai).

**How a deployment happens:**

1. Code is merged into `main` on GitHub (GitHub Actions has already built and tested it, including the Docker
   image).
2. On Render: **Manual Deploy → Deploy latest commit**. Render downloads the code and runs the `Dockerfile`:
   - stage 1 (Node): `npm ci` and `npm run build` → the React files;
   - stage 2 (.NET SDK): `dotnet restore` and `dotnet publish` → the API;
   - stage 3 (small ASP.NET runtime image): copies the API and puts the React files in `wwwroot`.
3. Render starts the container with the environment variables (database, JWT key, demo password, Razorpay).
4. On startup the app connects to Supabase, applies migrations, seeds the demo organization and starts
   Hangfire; Render checks `/api/health` and switches traffic to the new version.

**Free-plan limits to mention honestly:** the service sleeps after 15 minutes without visitors (first visit
then takes about a minute); Render's free plan blocks SMTP port 587, so email on the live site needs Brevo
(port 2525) or a paid plan.

**Viva questions**

1. *Why Docker?* – The app runs the same on any machine or cloud; the image contains everything it needs.
2. *Why one service instead of Vercel for the frontend?* – Same origin: the HttpOnly login cookie and the SignalR
   WebSocket work without cross-site problems.
3. *Where are secrets kept?* – .NET User Secrets on laptops, Render environment variables in production;
   never in GitHub.
4. *What is a health check?* – A URL (`/api/health`) the host calls to know the app started correctly before
   sending users to it.
5. *What is a multi-stage Docker build?* – Separate build images for Node and .NET, then a small final image
   with only the published output, so the deployed image is smaller and safer.
6. *What went wrong during deployment and how did you fix it?* – A badly pasted connection string, a JWT key
   shorter than 32 characters, a typo in the database password, and different demo passwords on the laptop
   and Render. Each was found from the Render logs and fixed in the environment variables; the app now gives a
   clearer message for the connection-string case.
7. *Why does the free plan sleep, and how do you handle it in a demo?* – To save resources; open the site a
   few minutes early, or ping `/api/health` with a free uptime monitor.

---

## 6. Demo script (10–12 minutes)

1. **Landing page** – explain the product and the three plans.
2. **Purchase** (if internet is good) – choose a plan, verify email, pay with the Razorpay test card
   (`5267 3181 8797 5449`, `12/30`, `123`), show the receipt PDF.
3. **Fleet Manager** (`manager@transitops.com`) – dashboard KPIs; add a vehicle with a wrong number
   (`ABC-123`) to show validation, then a right one; create a trip and dispatch it.
4. **Driver** (`driver@transitops.com`) – sees only own trips; complete the trip.
5. **Safety Officer** (`safety@transitops.com`) – click a safety score to show the breakdown; record an
   incident; show expired licences.
6. **Financial Analyst** (`analyst@transitops.com`) – profit, margin, cost/km; download the ledger PDF.
7. **Org Admin** (`admin@transitops.com`) – create a new Fleet Manager user.
8. **Show the code** – folder structure, one controller, the safety score formula, the UML diagrams.

---

## 7. General viva questions

1. **Why a web app and not a mobile app?** Works on any device with a browser; no installation.
2. **Why .NET for the backend?** Fast, secure, strongly typed C#, mature libraries (Identity, EF Core,
   SignalR), good for enterprise apps.
3. **Why React?** Component-based UI, large ecosystem, efficient updates.
4. **What is an API?** A set of URLs the frontend calls to read or change data (REST: GET, POST, PUT, DELETE).
5. **What is REST?** An API style where resources have URLs (`/api/vehicles`) and HTTP verbs say the action.
6. **What is SaaS / multi-tenancy?** Software rented online; many companies share one app but each sees only
   its own data.
7. **What is Clean Architecture?** Layers (Domain, Application, Infrastructure, Api) with dependencies
   pointing inward, so business rules don't depend on databases or web frameworks.
8. **How is the app secured?** Hashed passwords, JWT in HttpOnly cookie, role checks on every endpoint, tenant
   filtering, lockout and rate limiting, payment signature verification, secrets outside the code, HTTPS when
   deployed.
9. **What was the hardest part?** For example: preventing double dispatch under concurrent requests, or
   verifying payments safely.
10. **What would you add next?** Live GPS tracking, mobile app for drivers, GST tax invoices, pagination for
    large fleets, server-side logout (token revocation).

---

## 8. Glossary

| Word | Simple meaning |
|---|---|
| Endpoint | One API URL + action, e.g. `POST /api/trips` |
| DTO | A simple object used to send data in/out of the API |
| Entity | A class saved as a database table row |
| Middleware | Code that runs on every request (security, errors, CORS) |
| CORS | Browser rule about which websites may call the API |
| Hash | One-way scramble of a password; can't be reversed |
| Token | A signed proof that you're logged in |
| Idempotent | Doing it twice has the same effect as once |
| Transaction | All-or-nothing group of database changes |
| Index | Database lookup structure; a *unique* index forbids duplicates |
| Webhook | Another service calling our API when something happens |
| CI | Automatic build-and-test on every code change |
| Container | A packaged app with everything it needs to run |
