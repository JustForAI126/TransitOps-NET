# TransitOps Developer Handoff

This document is the project orientation guide for a developer or AI coding agent taking over TransitOps. It describes the repository as it is currently organized, explains the runtime flow and business rules, and points to the detailed setup and permission documents.

> **Source of truth:** the ASP.NET Core API and PostgreSQL database. The React client is a user interface, not an authorization boundary. Treat this guide as a map, then confirm the implementation in code before changing behavior.

## Contents

1. [Product summary](#1-product-summary)
2. [Technology and architecture](#2-technology-and-architecture)
3. [Repository structure and file catalog](#3-repository-structure-and-file-catalog)
4. [Application execution flow](#4-application-execution-flow)
5. [Roles, access control, and tenant rules](#5-roles-access-control-and-tenant-rules)
6. [Core workflow and business rules](#6-core-workflow-and-business-rules)
7. [Dashboard, financial metrics, and reports](#7-dashboard-financial-metrics-and-reports)
8. [Configuration and local execution](#8-configuration-and-local-execution)
9. [Developer guidance and known decisions](#9-developer-guidance-and-known-decisions)
10. [Viva questions and answers](#10-viva-questions-and-answers)

## 1. Product summary

TransitOps is a fleet and transport operations application. It brings together:

- Organization account provisioning and role assignment.
- Fleet vehicle and driver records.
- Trip planning, dispatch, completion, and cancellation.
- Driver licence and safety monitoring.
- Vehicle maintenance and operating expenses.
- Role-specific dashboards, analytics, and exports.
- Real-time event notifications through SignalR.
- Scheduled background checks through Hangfire.

The intended users are Organization Admins, Fleet Managers, Drivers, Safety Officers, and Financial Analysts. There is **no separate Dispatcher role** in the current application. The Driver role has dispatch-related API permissions; it should not be renamed or treated as a distinct Dispatcher without a product and authorization decision.

## 2. Technology and architecture

| Layer | Technology | Why it is used here |
|---|---|---|
| Browser UI | React 19, TypeScript, Tailwind CSS 4 | Component-based role experiences, typed client models, and utility-based styling. |
| Frontend tooling | Vite, TypeScript, npm (with a Bun lockfile also present) | Local development server, HMR, TypeScript checking, and production bundle. |
| Development/full-stack host | Node.js, Express, `tsx` | `frontend/server.ts` serves the Vite app in development and forwards API/hub calls to ASP.NET Core. |
| API | ASP.NET Core Web API, C# / .NET 10 preview target | Central place for business rules, validation, persistence, authorization, and integrations. |
| Identity | ASP.NET Core Identity | User/account management and password hashing. Passwords are not stored or returned as plaintext. |
| API authentication | JWT in an HttpOnly cookie | Browser authentication without storing bearer tokens in local storage. |
| Authorization | ASP.NET Core role attributes and tenant claims | Enforces endpoint permissions on the server, independently of hidden UI controls. |
| Persistence | EF Core and Npgsql with PostgreSQL | Relational model, transactions, constraints, and database access. |
| Input validation | FluentValidation | Central request rules for supported domain operations. |
| Real-time events | SignalR | Broadcasts operational updates to connected, authenticated clients. |
| Scheduled work | Hangfire with PostgreSQL storage | Persists and executes scheduled jobs, including the daily licence expiry check. |
| Exports | CsvHelper and QuestPDF | CSV data exports and generated PDF documents. |
| API exploration | Swagger / Swashbuckle, Postman | Interactive API description and reusable manual request collection. |

### Dependency direction

The backend solution is divided into four projects:

```text
TransitOps.Api  ->  TransitOps.Application  ->  TransitOps.Domain
       |                         ^
       +----> TransitOps.Infrastructure ----+
```

- **Domain** contains the core entities and enums, without HTTP-specific behavior.
- **Application** contains request/response DTOs, validators, and service contracts/report implementations.
- **Infrastructure** connects application behavior to PostgreSQL/EF Core and background jobs.
- **Api** composes the application at startup and exposes HTTP endpoints, authentication, authorization, and SignalR.

The actual implementation is intentionally pragmatic rather than a strict Clean Architecture template: several controllers access `TransitOpsDbContext` directly. Do not document or assume a repository/mediator layer that is not present.

## 3. Repository structure and file catalog

Generated directories such as `node_modules/`, `dist/`, `.NET bin/obj/`, and `.git/` are not source. The updated `.gitignore` excludes those outputs. The catalog below describes the source/configuration files currently in the repository.

### Root

| Path | Purpose |
|---|---|
| `.gitignore` | Excludes frontend dependencies/build outputs, .NET build/test outputs, local environment files, logs, and OS metadata. `.env.example` remains trackable. |
| `frontend/` | React/TypeScript application, frontend tooling, Node host, package manifests, and frontend-local environment configuration. See the frontend catalog below. |
| `postman_collection.json` | Root copy of the Postman API collection for manual API testing. Keep in sync with `backend/TransitOps.Api/postman_collection.json` if both are maintained. |

### `frontend/` — React application and tooling

| Path | Purpose |
|---|---|
| `frontend/.env` | Local frontend environment values; ignored by Git. Do not put backend secrets here. |
| `frontend/.env.example` | Trackable template for frontend-host values such as the Express port and API URL. Backend secrets are configured separately using .NET User Secrets in Development or an approved deployment secret store. |
| `frontend/package.json` | Frontend/Node dependency manifest and scripts: `dev`, `dev:dotnet`, `build`, `preview`, `clean`, `lint`, and `start`. |
| `frontend/package-lock.json` | npm dependency resolution lockfile. Use npm commands so dependency changes keep this file synchronized. |
| `frontend/bun.lock` | Bun lockfile; retained in the repository. Confirm the team’s package-manager policy before changing or removing it. |
| `frontend/tsconfig.json` | TypeScript compiler options, strictness settings, and included source files. `npm --prefix frontend run lint` runs `tsc --noEmit`. |
| `frontend/vite.config.ts` | React and Tailwind Vite plugins, frontend aliases, development server, and direct API/hub/Swagger proxy configuration for `dev:dotnet`. |
| `frontend/server.ts` | Express development/full-stack host. It starts Vite middleware outside production, forwards `/api`, `/hubs`, and `/swagger` requests to ASP.NET Core, and serves built frontend files in production mode. |
| `frontend/index.html` | HTML document shell, metadata, font preconnects, and the root element loaded by `frontend/src/main.tsx`. |
| `frontend/metadata.json` | Project metadata consumed by the surrounding development environment; not the application database. |
| `frontend/data/transitops_store.json` | Tracked JSON data snapshot. PostgreSQL, accessed through the API, is the authoritative persistence layer; this snapshot is not used as the runtime store. |

### `frontend/src/` — React frontend source

| Path | Responsibility |
|---|---|
| `frontend/src/main.tsx` | Browser entry point. Mounts the React application and global CSS. |
| `frontend/src/App.tsx` | Composes providers, route/view selection, role-allowed views, layout, global navigation, notifications, and modal lifecycles. It redirects unauthenticated protected navigation to login and constrains views by role; backend authorization remains authoritative. |
| `frontend/src/index.css` | Global styles, Tailwind import/theme setup, and application-wide CSS. |
| `frontend/src/types.ts` | Shared frontend domain types for roles, vehicles, drivers, trips, expenses, maintenance, users, and KPIs. |
| `frontend/src/context/AppContext.tsx` | Central client state and workflows: session verification/login/logout, role and view state, API data loading, operational mutations, SignalR subscriptions, notifications, filters, KPIs, ROI, and CSV generation. |
| `frontend/src/context/ThemeContext.tsx` | Theme state/provider used by components to render light/dark palettes. |
| `frontend/src/services/api.ts` | Typed frontend API wrapper. Sends cookies with requests, parses API errors, normalizes selected API enum/field values, and exposes authentication, entity, and report operations. |
| `frontend/src/services/signalr.ts` | SignalR connection lifecycle and event-to-client callback dispatch. |
| `frontend/src/utils/currency.ts` | Shared INR formatting helpers. |
| `frontend/src/data/initialData.ts` | Frontend-side initial/example data definitions. The persisted runtime source is PostgreSQL; inspect actual imports before relying on this data for production behavior. |
| `frontend/src/components/Navbar.tsx` | Top navigation, brand identity, theme control, notifications, role context, and sign-out/quick actions. |
| `frontend/src/components/Sidebar.tsx` | Role-filtered application navigation and workspace counters. These visible navigation rules are UX only, not API security. |
| `frontend/src/components/NotificationToast.tsx` | Displays transient application notifications. |
| `frontend/src/components/SplashScreen.tsx` | Intro/loading presentation shown during the initial splash state. |
| `frontend/src/components/views/HeroView.tsx` | Public product landing page and entry point to sign in. |
| `frontend/src/components/views/AuthViews.tsx` | Login interface and legacy registration component. Public registration is not part of the intended account-provisioning flow. |
| `frontend/src/components/views/SaasOnboardingView.tsx` | Public email-verification, plan selection, Razorpay Checkout, retryable confirmation, and password-setup UI. It sends payment results to the API for verification; it never provisions an organization itself. |
| `frontend/src/components/views/DashboardView.tsx` | Chooses the role-specific dashboard and displays loading/error/retry state or first-use onboarding. |
| `frontend/src/components/views/OrganizationAdminDashboard.tsx` | Lists organization users and creates tenant-scoped Fleet Manager, Driver, Safety Officer, and Financial Analyst accounts. Driver account creation also includes driver profile information. |
| `frontend/src/components/views/VehiclesView.tsx` | Vehicle search/list/detail, lifecycle/status actions, and vehicle-related display/export behavior. |
| `frontend/src/components/views/DriversView.tsx` | Driver list/detail, licence/safety indicators, and authorized driver actions. |
| `frontend/src/components/views/TripsView.tsx` | Trip planning and trip queue/dispatch/completion/cancellation interface, with available trip receipt export. |
| `frontend/src/components/views/MaintenanceView.tsx` | Maintenance work order listing, creation, and closure UI, subject to role rules. |
| `frontend/src/components/views/ExpensesView.tsx` | Fuel and other expense viewing and supported expense actions. |
| `frontend/src/components/views/ReportsView.tsx` | Financial and vehicle ROI summaries, filters/sorts, CSV export controls, and role-specific PDF downloads. |
| `frontend/src/components/views/AnalyticsView.tsx` | Analytics presentation using current workspace metrics and shared app data. |
| `frontend/src/components/dashboard/FleetManagerDashboard.tsx` | Fleet KPIs, vehicle filters, dispatch overview, operational attention items, and Fleet Manager actions. |
| `frontend/src/components/dashboard/DriverDashboard.tsx` | Driver-focused trip/dispatch dashboard. |
| `frontend/src/components/dashboard/SafetyOfficerDashboard.tsx` | Licence, driver safety, and active maintenance safety dashboard. |
| `frontend/src/components/dashboard/FinancialAnalystDashboard.tsx` | Financial analysis and cost/revenue dashboard. |
| `frontend/src/components/dashboard/GettingStartedGuide.tsx` | First-use guidance and actions for non-demo organizations with a clean workspace. |
| `frontend/src/components/dashboard/LiveRouteRadar.tsx` | Visualizes persisted active trip routes. It does not represent live GPS because location coordinates are not modeled. |
| `frontend/src/components/modals/AddVehicleModal.tsx` | Vehicle creation form and client-side feedback. API validators and controller checks must still be used. |
| `frontend/src/components/modals/AddDriverModal.tsx` | Driver creation form, licence category choices, and error feedback. |
| `frontend/src/components/modals/CreateTripModal.tsx` | Trip draft creation and vehicle/driver selection. |
| `frontend/src/components/modals/CompleteTripModal.tsx` | Captures final odometer/fuel details for completion. |
| `frontend/src/components/modals/LogMaintenanceModal.tsx` | Creates maintenance work orders. |

### `backend/` — ASP.NET Core solution

| Path | Responsibility |
|---|---|
| `backend/TransitOps.sln` | Groups all backend projects for build and IDE workflows. |
| `backend/Dockerfile` | Multi-stage container build/publish and ASP.NET Core runtime image. |
| `backend/TransitOps.Domain/TransitOps.Domain.csproj` | Domain project definition and target framework. |
| `backend/TransitOps.Domain/Entities/Entities.cs` | Entity types for Identity users, vehicles, vehicle documents, drivers, trips, maintenance, and expenses. |
| `backend/TransitOps.Domain/Enums/Enums.cs` | Authoritative backend enums for roles, statuses, vehicle types, and expense types. |
| `backend/TransitOps.Application/TransitOps.Application.csproj` | Application project definition and FluentValidation, CsvHelper, and QuestPDF dependencies. |
| `backend/TransitOps.Application/DTOs/Dtos.cs` | API input/output records and KPI/report DTOs. Keep API shapes separate from EF entities where already implemented. |
| `backend/TransitOps.Application/Validators/Validators.cs` | FluentValidation rules for supported API requests. |
| `backend/TransitOps.Application/Services/IKpiService.cs` | KPI service contract consumed by the API. |
| `backend/TransitOps.Application/Reports/CsvHelperService.cs` | CSV generation service abstraction/implementation used by report exports. |
| `backend/TransitOps.Application/Reports/QuestPdfReportService.cs` | PDF report types and QuestPDF generation for the financial ledger, trip receipt, and fleet ROI summary. |
| `backend/TransitOps.Infrastructure/TransitOps.Infrastructure.csproj` | Infrastructure project definition and EF Core/Npgsql/Hangfire dependencies. |
| `backend/TransitOps.Infrastructure/Persistence/TransitOpsDbContext.cs` | EF Core Identity context, entity sets, enum conversions, indexes, constraints, precision, and relationships. |
| `backend/TransitOps.Infrastructure/Persistence/Migrations/` | Additive migrations for SaaS organizations, subscriptions, purchase state, webhook idempotency, and email verification retry state. |
| `backend/TransitOps.Infrastructure/Services/SaasOnboardingService.cs` | Server-authoritative email verification, Razorpay order/payment/webhook verification, idempotent tenant/subscription creation, SMTP delivery, and one-time admin setup. |
| `backend/TransitOps.Infrastructure/Services/SaasOnboardingOptions.cs` | Configurable plan catalog and server-side Razorpay, SMTP, and public app options. |
| `backend/TransitOps.Infrastructure/Services/KpiService.cs` | PostgreSQL/EF Core-backed role KPI calculations behind `IKpiService`. |
| `backend/TransitOps.Infrastructure/BackgroundJobs/HangfireJobs.cs` | Scheduled tasks for licence expiry review, maintenance schedule audit, and stale trip reconciliation. |
| `backend/TransitOps.Api/TransitOps.Api.csproj` | Web API project definition, target framework, project references, and API-specific packages. Contains the `UserSecretsId`; the actual secret values belong outside the repository. |
| `backend/TransitOps.Api/Program.cs` | Composition root: configuration, PostgreSQL, Identity, JWT, authorization policies, SignalR, Hangfire, validation, CORS, Swagger, middleware, controllers, startup schema initialization, and Development-only demo seeding. |
| `backend/TransitOps.Api/appsettings.json` | Non-secret API defaults such as logging, JWT issuer/audience, CORS origins, and allowed hosts. Do not put database credentials or signing secrets here. |
| `backend/TransitOps.Api/Properties/launchSettings.json` | Local launch profile/environment and localhost API URL/port used by `dotnet run`. |
| `backend/TransitOps.Api/Hubs/TransitOpsHub.cs` | Authenticated SignalR hub and client event contract. |
| `backend/TransitOps.Api/Controllers/AuthController.cs` | Login, current session (`me`), and logout. Login is anonymous; protected operations require a valid authenticated identity. |
| `backend/TransitOps.Api/Controllers/OnboardingController.cs` | Anonymous, rate-limited email verification, plan listing, order creation, signed Razorpay confirmation/webhook, and setup endpoints. |
| `backend/TransitOps.Api/Controllers/OrganizationUsersController.cs` | Organization Admin-only tenant user listing and account creation, including driver profile linkage. |
| `backend/TransitOps.Api/Controllers/VehiclesController.cs` | Tenant-scoped vehicle listing/details, create/update/status/retire endpoints, validations, and lifecycle checks. |
| `backend/TransitOps.Api/Controllers/DriversController.cs` | Tenant-scoped driver CRUD/updates, suspension toggle, and licence reminders, limited by role. |
| `backend/TransitOps.Api/Controllers/TripsController.cs` | Tenant-scoped trip listing and create/dispatch/complete/cancel workflows; validates driver and vehicle eligibility and emits relevant SignalR events. |
| `backend/TransitOps.Api/Controllers/MaintenanceController.cs` | Maintenance record listing, create, and close operations with role restrictions. |
| `backend/TransitOps.Api/Controllers/ExpensesController.cs` | Expense listing, create, and delete operations, with tenant and role restrictions. |
| `backend/TransitOps.Api/Controllers/KpiController.cs` | Role-protected API endpoints for Fleet, Driver, Safety, and Financial KPI data. |
| `backend/TransitOps.Api/Controllers/ReportsController.cs` | CSV trip export and role-protected financial ledger, vehicle ROI, and trip receipt PDF exports. |
| `backend/TransitOps.Api/Controllers/DocsController.cs` | API endpoint for exposing the Postman collection/documentation payload. |
| `backend/TransitOps.Api/postman_collection.json` | Backend-local Postman collection copy. Keep in sync with the root copy when changing endpoints. |
| `backend/TransitOps.Api/Reports.http` | HTTP-client example for signing in as a Development Fleet Manager and downloading the ROI PDF. |

### `db scripts/`

| Path | Responsibility |
|---|---|
| `db scripts/SUPABASE_RLS_FIX.sql` | Supabase/PostgreSQL RLS repair/setup script. Review before execution against a real database; it is not a substitute for API tenant filtering. |
| `db scripts/supabase-rls-setup.sql` | Supabase RLS setup script. Apply only to the intended database and understand each policy before running it. |

### `Markdown files/`

| Path | Responsibility |
|---|---|
| `Markdown files/DEVELOPER_HANDOFF.md` | This implementation-aware architecture, execution, and viva guide. |
| `Markdown files/SETUP_GUIDE.md` | Local configuration and startup instructions, credentials guidance, and operating notes. |
| `Markdown files/ACCESS_AND_KPI.md` | Detailed role/resource permission matrix, tenant boundaries, KPI formulas, ROI definition, and open product decisions. |
| `Markdown files/TRANSITOPS_ARCHITECTURE_GUIDE.md` | Additional junior-developer domain and architecture explanation. Compare its examples with current code; it may contain illustrative or older design descriptions. |

## 4. Application execution flow

### 4.1 Starting the frontend and API

The normal local setup uses two processes:

1. `dotnet run --project backend\TransitOps.Api\TransitOps.Api.csproj` starts the API on the configured localhost URL (typically `http://localhost:5000`).
2. `npm --prefix frontend run dev` starts `frontend/server.ts` on `http://localhost:3000`, with Vite middleware for the React app.
3. Browser calls to `/api`, `/hubs`, and `/swagger` pass through the Express bridge to the API. The browser therefore uses the frontend origin while the Node server contacts ASP.NET Core.
4. `npm --prefix frontend run dev:dotnet` runs Vite directly; its proxy uses `VITE_BACKEND_URL` when supplied, otherwise `http://localhost:5000`.
5. `npm --prefix frontend run build` produces the frontend production bundle in `frontend/dist/`.

The API must be running and reachable for authentication, persisted data, report generation, and real-time connections. A frontend server can start even while the API is down; that does not imply the API is healthy.

### 4.2 ASP.NET Core startup

`Program.cs` configures application services in this order conceptually:

1. Load configuration and validate required PostgreSQL/JWT values. Development demo seeding also requires `DemoAccounts:Password`.
2. Configure Npgsql/EF Core and ASP.NET Core Identity.
3. Configure JWT validation, with cookie-token extraction for HTTP and access-token extraction for SignalR hub requests.
4. Configure a fallback authorization policy requiring an authenticated user and a `tenant_id` claim; define role policies.
5. Register SignalR, Hangfire PostgreSQL storage/server, FluentValidation, KPI/export services, CORS, MVC controllers, error details, rate limiting, and Swagger.
6. Build the app and install exception, routing, CORS, rate-limit, authentication, authorization, and endpoint middleware.
7. Map API controllers and the SignalR hub.
8. Call `EnsureCreated()` for a fresh schema and then apply additive EF migrations. Startup also applies PostgreSQL indexes/column compatibility SQL.
9. Only in Development, seed demo fleet data/accounts. Seeding should be idempotent so repeated app starts do not create duplicate fixtures.
10. Register recurring Hangfire jobs with the service-based `IRecurringJobManager`, then run the web host.

**Schema caution:** `EnsureCreated()` does not upgrade an existing schema. New SaaS tables are covered by idempotent migrations, with an extra `ADD COLUMN IF NOT EXISTS` for verification resends; review and back up databases before applying migrations.

### 4.3 Browser session and route selection

1. `AppProvider` checks the current session by calling `/api/auth/me`.
2. Login posts credentials to `/api/auth/login`. ASP.NET Identity validates credentials and lockout state; a successful login issues an HttpOnly JWT cookie and returns the user profile/role/tenant.
3. The frontend stores the session profile in React state, not the raw JWT in local storage.
4. `App.tsx` selects a public hero/login view or an authenticated role-allowed view. Attempts to open protected UI routes without a session lead to login; authenticated users are constrained to their role’s available views.
5. Each data API also validates authentication, role, and tenant independently. A user cannot gain API access just by typing a URL or manipulating browser state.
6. Logout calls `/api/auth/logout`, clears the cookie, and removes in-memory workspace state.

### 4.4 Data loading and real-time refresh

`AppContext.refreshData()` requests only the resource collections needed by the current role, using `Promise.all` for concurrent reads. An organization admin gets account-administration data rather than operational fleet collections. On a load failure, data is cleared and an error/retry state is shown.

After authentication, the SignalR client connects to `/hubs/transitops`. Relevant hub events trigger a data refresh or notification. The hub is for timely UI updates; persisted API data remains authoritative.

## 5. Roles, access control, and tenant rules

| Role | Intended application focus |
|---|---|
| Organization Admin | Create and list organization users; assign operational roles. |
| Fleet Manager | Operate vehicle/driver/trip/maintenance workflows, review fleet KPIs and reports, export fleet ROI. |
| Driver | View assigned trips, complete dispatched trips assigned to the linked driver profile, and download own trip receipts. Creating, dispatching, and cancelling trips are Fleet Manager-only actions. |
| Safety Officer | Review and manage driver compliance/safety and maintenance safety information. |
| Financial Analyst | Review financial and trip information, expenses/maintenance costs as permitted, and download the financial ledger. |

### Security rules

- API authorization attributes and policies are the real permission boundary. UI role menus only hide irrelevant views/actions.
- Protected data is filtered by the `tenant_id` claim. Controllers should scope every entity query and mutation to the current tenant.
- The frontend sends cookies using `credentials: 'include'`; it should not save the JWT to `localStorage`.
- Passwords are managed by Identity and stored as password hashes.
- Login failure throttling/lockout is configured in the API. Do not return details that disclose whether a specific email exists.
- Financial fields are restricted/redacted for roles that are not authorized to see them.
- Retiring a vehicle is preferred to deleting it where history must remain available.
- The demo records belong to `demo_tenant`. Users created by the demo admin join that tenant and share its records. A real organization must be created with a distinct tenant ID to receive an empty workspace.
- Demo identities are Development-only. Paid onboarding now uses verified email, server-created Razorpay Test Mode orders, server-verified captured payments, tenant-scoped organization/subscription records, and a single-use admin setup link. Recurring billing, live-mode payment processing, automated renewals, and billing management are not implemented.

See [`ACCESS_AND_KPI.md`](./ACCESS_AND_KPI.md) for the detailed resource/action permission matrix and known authorization design decisions.

## 6. Core workflow and business rules

### Fleet and driver setup

- Fleet Managers create and maintain vehicle and driver data.
- Organization Admins create the sign-in account for an operational user. For a Driver, the API also creates a linked driver profile in the same tenant.
- Supported vehicle statuses are Available, On Trip, In Shop, and Retired.
- Supported driver states include Available, On Duty, On Trip, Off Duty, and Suspended.
- Vehicle registration and driver license/email identifiers have normalization/uniqueness protections; database indexes provide race-safe constraints for configured keys.

### Trip lifecycle

The standard lifecycle is:

```text
Draft -> Dispatched -> Completed
   \----------------> Cancelled (where allowed)
```

- A trip draft references a vehicle and driver from the same tenant.
- Cargo cannot exceed the selected vehicle’s load capacity.
- A vehicle must be Available to dispatch; On Trip, In Shop, or Retired vehicles are not dispatchable.
- A suspended, off-duty, already-on-trip, or expired-license driver is rejected during trip creation/dispatch validation as applicable.
- Dispatch changes trip, vehicle, and driver status within a database transaction. Partial unique indexes prevent two dispatched trips from sharing a vehicle or driver.
- Completion records final odometer/fuel values and updates relevant trip/fleet state. Cancellation changes trip state without deleting history.
- Trip status transitions and authorization are enforced by API handlers, not by modal validation alone.

### Maintenance and expenses

- Maintenance work is recorded against a tenant vehicle; authorized staff create and close work orders.
- Active maintenance holds keep a vehicle from being dispatched.
- Expense records can refer to a vehicle and/or trip. Expense categories include fuel, toll, maintenance, permit, insurance, and other.
- Deleting an expense does not imply deleting historical trips or vehicles.

### Driver license lifecycle

- License expiry is evaluated against the current UTC date/date-only value.
- Dispatch validation blocks expired or suspended drivers.
- Hangfire’s daily licence-expiry job reviews drivers; expired records can be automatically suspended.
- The user interface displays upcoming/expired licences and supports reminders where authorized.

## 7. Dashboard, financial metrics, and reports

### Fleet dashboard

The Fleet Manager dashboard’s vehicle type/status/region filters affect vehicle metrics and trips assigned to those vehicles. Drivers On Duty is not region/type-filtered because the model does not associate drivers with fleet regions.

- **Active Vehicles:** count of vehicles with status `On Trip`.
- **Available Vehicles:** count with status `Available`.
- **Vehicles in Maintenance:** count with status `In Shop`.
- **Active Trips:** count of `Dispatched` trips assigned to the filtered vehicles.
- **Pending Trips:** count of `Draft` trips assigned to the filtered vehicles.
- **Drivers On Duty:** count of records with status `On Duty`.
- **Fleet Utilization:** `On Trip vehicles / non-retired vehicles × 100`; dashboard rounding is to one decimal place in the Fleet Manager dashboard, or integer in the generic context helper. Zero when denominator is zero.
- Retired vehicles are not in the utilization denominator.

The exact permission and KPI details are documented in [`ACCESS_AND_KPI.md`](./ACCESS_AND_KPI.md). Be aware that the backend fleet KPI endpoint and the UI’s filtered dashboard may represent different scopes: API KPI values are tenant-wide, while the dashboard view applies local filters.

### Financial and vehicle ROI

- Financial reports use persisted tenant data. Completed trips contribute revenue.
- Operating expense combines maintenance, fuel, and non-fuel expenses where the report requires total OPEX.
- Per-vehicle ROI uses `operating profit = completed-trip revenue − maintenance − fuel`, then `ROI = operating profit / acquisition cost × 100`. Acquisition cost is invested capital (the denominator), not an additional operating cost.
- The Fleet Manager ROI PDF includes dashboard counts/utilization and averages for completed-trip revenue/distance and per-vehicle operating cost/profit/ROI.
- PDF and CSV generation happens server-side; download actions call role-protected API endpoints and surface errors in the UI.

No GPS location model is present: the route radar visualizes saved trip routes, not live vehicle coordinates.

## 8. Configuration and local execution

Follow [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) for exact setup commands.

Minimum operational checklist:

1. Install Node.js/npm and the .NET SDK version matching the solution.
2. Install frontend dependencies with `npm --prefix frontend install`.
3. Configure `ConnectionStrings:DefaultConnection`, `Jwt:Key`, `DemoAccounts:Password`, Razorpay Test Mode credentials, and SMTP credentials with .NET User Secrets for Development. Never commit secret values.
4. Run PostgreSQL (or configure a reachable PostgreSQL/Supabase connection).
5. Start ASP.NET Core, then start the frontend host in a second terminal.
6. Browse to `http://localhost:3000`; use the configured Development demo password if signing in with seeded demo accounts.
7. Validate the API in Swagger or with the Postman collection.

Useful commands from the repository root:

```powershell
npm --prefix frontend install
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run dev
dotnet build backend\TransitOps.sln
dotnet run --project backend\TransitOps.Api\TransitOps.Api.csproj
```

`npm --prefix frontend run dev` uses Express and `DOTNET_API_URL`; `npm --prefix frontend run dev:dotnet` uses Vite’s proxy and `VITE_BACKEND_URL`. Do not assume those variable names are interchangeable. Backend secrets are independent of frontend `.env` files. The frontend package scripts can also be run after changing the working directory to `frontend\`.

## 9. Developer guidance and known decisions

### Before changing code

1. Find the existing endpoint, validator, model, and frontend service method before adding a parallel implementation.
2. Treat `Program.cs`, the API controller, FluentValidation rules, EF model/indexes, `api.ts`, and role view rules as related surfaces.
3. For any tenant-owned database query, derive the tenant from the authenticated claim and include it in reads and writes.
4. Add input validation and race-safe database constraints for uniqueness/concurrency rules.
5. Keep UI validation for usability, but duplicate security-sensitive checks in the backend.
6. Update the access/KPI docs when permission or formula behavior changes.
7. Run targeted checks and builds. There is currently no dedicated test project in the listed backend solution.
8. Do not treat an ASP.NET build as a live PostgreSQL, seeding, Hangfire, SignalR, or PDF integration test.

### Known limitations / decisions not to silently assume

- **Driver vs Dispatcher:** only `Driver` exists; drivers can view and complete trips assigned to their linked profile, but cannot create, dispatch, or cancel trips.
- **Subscription billing:** the current checkout is a one-time Razorpay charge for a fixed configured term. It does not auto-renew and does not implement Razorpay Subscriptions.
- **Onboarding configuration:** email verification requires SMTP; payment order creation/verification requires Test Mode Razorpay credentials. Missing configuration fails closed rather than simulating success.
- **KPI scope:** frontend filtered Fleet Manager cards and backend tenant-wide KPI endpoints do not necessarily share exactly the same scope.
- **Uniqueness scope:** current normalized uniqueness indexes are global for the protected values, not tenant-local; changing this requires a product/data migration decision.
- **Dashboard averages:** ROI PDF averages are explicit report averages. Do not present them as a time-windowed KPI; no reporting-period selector is currently defined.
- **Schema changes:** SaaS onboarding adds idempotent EF migrations. `EnsureCreated()` still initializes only fresh databases and must not be treated as a general schema-upgrade mechanism.
- **Documentation drift:** the older architecture guide includes illustrative architectural language and examples. Verify all claims against actual source before using them as a specification.
- **Local JSON snapshot:** PostgreSQL is the runtime backend source of truth. `frontend/data/transitops_store.json` is a retained snapshot and is not the runtime data store.

## 10. Viva questions and answers

### Architecture and stack

1. **What problem does TransitOps solve?**  
   It centralizes fleet assets, driver compliance, trips, maintenance, expenses, dashboards, and exports for a transport organization.

2. **Why separate Domain, Application, Infrastructure, and API projects?**  
   It separates business types, request/validation/report capabilities, database/integration implementation, and HTTP hosting concerns, making responsibilities easier to reason about.

3. **What is the role of `Program.cs`?**  
   It is the composition root: reads configuration, registers dependencies and middleware, maps endpoints, initializes schema/seeds in Development, and starts scheduled jobs.

4. **What is Entity Framework Core doing?**  
   EF Core maps C# entities and relationships to PostgreSQL tables and translates LINQ queries into SQL through Npgsql.

5. **What is the difference between Domain and DTOs?**  
   Domain entities model persisted/business data. DTOs define the API request/response shape and should avoid exposing persistence details.

6. **Why use FluentValidation if the UI validates forms?**  
   UI validation improves feedback, but clients can be bypassed. Backend validation protects the API regardless of the caller.

### Identity and security

7. **How are passwords stored?**  
   ASP.NET Core Identity hashes passwords and verifies submitted credentials; the application must never store or return plaintext passwords.

8. **Where is the JWT stored in the browser?**  
   It is issued in an HttpOnly cookie. The frontend does not keep the token in local storage, which reduces exposure to JavaScript-based token theft.

9. **What is RBAC?**  
   Role-Based Access Control grants or denies API operations according to the authenticated user’s assigned role.

10. **Why is hiding a navigation item not sufficient authorization?**  
    A user can call an API directly or manipulate the browser. The server must enforce authentication and role requirements for every protected endpoint.

11. **How does tenant isolation work?**  
    The authenticated user has a tenant claim; API queries and writes scope tenant-owned records to that claim.

12. **How is the first production Organization Admin provisioned?**  
    A verified organization email and captured Razorpay payment are required before a time-limited single-use setup link is sent. The customer chooses a password; the backend assigns only the tenant-scoped `OrganizationAdmin` role.

13. **Can Driver and Dispatcher be used as synonyms here?**  
    No. The code defines Driver only. Drivers can view and complete only trips assigned to their linked driver profile; they cannot create, dispatch, or cancel trips.

### Workflow and persistence

14. **What are the main trip states?**  
    Draft, Dispatched, Completed, and Cancelled.

15. **What prevents overloading a vehicle?**  
    The API checks requested cargo weight against the selected vehicle’s maximum capacity.

16. **What prevents dispatching the same vehicle or driver twice concurrently?**  
    Dispatch executes transactionally and PostgreSQL partial unique indexes enforce one active dispatched trip per vehicle and per driver.

17. **Why is retirement preferable to physical deletion for vehicles?**  
    Retirement preserves references and audit history for prior trips, expenses, and maintenance.

18. **How are license expirations handled?**  
    Dispatch checks the license date, and a Hangfire background job reviews expiring/expired licenses on a schedule.

19. **What is SignalR used for?**  
    It sends operational events to connected clients so they can refresh persisted views or show notifications without manual reload.

20. **What is Hangfire used for?**  
    It schedules and persists background work, such as the daily license expiry review, using PostgreSQL job storage.

### Metrics and reports

21. **How is fleet utilization calculated?**  
    On-trip vehicles divided by non-retired vehicles, multiplied by 100; zero if no eligible vehicles exist.

22. **How is vehicle ROI calculated?**  
    Completed-trip revenue minus vehicle maintenance and fuel costs gives operating profit. Divide that by acquisition cost and multiply by 100.

23. **Why not subtract acquisition cost from profit and also divide by acquisition cost?**  
    Acquisition cost is capital invested, not operating expense in this formula. Subtracting it and using it as denominator would mix operating margin and capital return.

24. **Why might a KPI differ between a dashboard and an API KPI endpoint?**  
    The dashboard may apply client-side vehicle filters, while a backend KPI endpoint may calculate tenant-wide totals. KPI scope must be made explicit.

25. **What does the route radar show?**  
    It shows saved trip routes and dispatch statuses. It is not live GPS tracking because coordinates are not stored in the current model.

26. **How are reports produced?**  
    CSV data is serialized with CsvHelper and PDF layouts are rendered by QuestPDF on the server, behind role-protected report endpoints.

### Execution and maintenance

27. **Why run the frontend and backend in separate terminals?**  
    The frontend host provides the browser application and proxy, while ASP.NET Core owns API, authentication, business rules, and database access.

28. **What does `npm --prefix frontend run lint` currently check?**

    It runs the TypeScript compiler with `--noEmit`; it is a type-check command, not a full ESLint rule set.

29. **What does `npm --prefix frontend run build` verify?**

    It bundles the production React/Vite frontend. It does not test database connectivity or backend behavior.

30. **What is the purpose of `.gitignore`?**  
    It prevents generated output, local secrets/environment files, and machine-specific files from being committed.

31. **Why is `EnsureCreated()` not a migration strategy?**  
    It can create a missing schema, but does not upgrade existing schemas safely. EF migrations are required for controlled schema changes.

32. **What should be checked when the frontend proxy reports API unavailable?**  
    Confirm the API process is listening at the configured URL, inspect API startup logs (especially PostgreSQL/JWT configuration), and verify the bridge/Vite proxy points to the correct port.
