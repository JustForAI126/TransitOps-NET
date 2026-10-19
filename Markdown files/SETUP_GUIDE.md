# TransitOps Setup Guide

For the complete directory catalog, application flow, business rules, and developer handoff notes, see [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md).

TransitOps uses a React/Vite client, an ASP.NET Core Web API, PostgreSQL through EF Core, ASP.NET Core Identity with JWT cookies, SignalR, FluentValidation, Hangfire, CsvHelper, and QuestPDF. The Express server is a development/full-stack host and API bridge; PostgreSQL-backed ASP.NET Core is the only application API and data store.

## Prerequisites

- Node.js 20+ and npm 10+
- .NET SDK 10
- PostgreSQL 15+ (or a Supabase PostgreSQL database)

## Configure and run locally

1. Install the JavaScript dependencies:

   ```powershell
   npm install
   ```

2. Save backend secrets once with .NET User Secrets. The API project loads them automatically in Development. User Secrets are stored outside the repository, so you do not need to set environment variables each time you run the API. They are a local-development convenience, not an encrypted production secret store; use your deployment platform's secret manager in production.

   ```powershell
   $apiProject = "backend\TransitOps.Api\TransitOps.Api.csproj"
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=transitops;Username=transitops_app;Password=<your-db-password>;SSL Mode=Prefer" --project $apiProject
   $jwtKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   dotnet user-secrets set "Jwt:Key" $jwtKey --project $apiProject
   dotnet user-secrets set "DemoAccounts:Password" "<strong-development-password>" --project $apiProject
   ```

   Replace the database password and demo password placeholders with private values. Identity requires the demo password to be at least 10 characters and contain uppercase, lowercase, numeric, and non-alphanumeric characters. The generated JWT key is saved to User Secrets.

   For Supabase instead of local PostgreSQL, use the **Session pooler** connection string from the Supabase Dashboard's Connect panel if the direct database host is unreachable over IPv6:

   ```powershell
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<Supabase Session pooler connection string>" --project $apiProject
   ```

   `Jwt:Issuer`, `Jwt:Audience`, `Cors:AllowedOrigins`, and the API URL are non-secret defaults in `backend\TransitOps.Api\appsettings.json` and `backend\TransitOps.Api\Properties\launchSettings.json`. Change `Cors:AllowedOrigins` there if your frontend uses a different origin. Do not put service-role keys or database passwords in `VITE_*` variables; browser code must not connect directly to PostgreSQL.

3. Start the API:

   ```powershell
   dotnet run --project backend\TransitOps.Api\TransitOps.Api.csproj
   ```

   The launch profile selects Development and `http://localhost:5000` automatically. Saved User Secrets are loaded on each run.

4. In a second terminal, start the React client and Express bridge:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`. API requests and SignalR traffic are proxied to the ASP.NET Core service.

   If the frontend logs a `Premature close` while a browser request is being cancelled or navigated away from, the bridge treats that as a disconnected client and cancels the upstream request without reporting the API as unavailable. It also omits upstream content lengths when streaming responses, since response decompression can change the byte count. For a genuine `502 API unavailable`, check that the API is listening at `http://localhost:5000` and inspect the ASP.NET Core console for startup or database errors.

## Database initialization

The API requires PostgreSQL and fails startup if the connection string or JWT configuration is missing. On startup it applies EF Core migrations when present; this repository currently relies on `EnsureCreated()` when there are no migrations. `EnsureCreated()` creates a fresh schema but does not upgrade an existing schema. Before production schema changes, add and apply EF Core migrations; do not rely on `EnsureCreated()` for an existing database.

The database connection must be held only by the backend. Tenant filtering and role authorization are enforced by API endpoints. If using Supabase, use the SQL scripts only to enable RLS without public policies; they deliberately do not install permissive `USING (true)` policies. The configured backend database principal must be able to perform its trusted server-side operations. Never expose a database password, service-role key, or unrestricted policy to the browser.

## Authentication, demo accounts, and organization administration

- The public UI and API do not provide registration. Users must be created by an Organization Admin so every account belongs to its fleet organization.
- In Development, startup seeds the demo tenant's sample fleet data and demo accounts. `DemoAccounts:Password` is required in Development and should be stored in .NET User Secrets; it is synchronized to the seeded demo accounts on each startup so the configured password remains usable. Sample records are only seeded in Development.
- Seed data belongs to the `demo_tenant`, not to individual identities. Accounts created by the demo Organization Admin join that same demo organization and share its seeded workspace. A newly provisioned organization must receive a separate tenant to start clean; the production purchase-to-organization provisioning integration is not implemented yet.
- Development sample data is added idempotently: 12 vehicles, 12 drivers, 120 historical trips plus the active demo dispatch, 24 maintenance records, and trip/overhead expenses. The landing page is available at `/`; unauthenticated requests to operational paths are redirected to `/login`.
- Identity requires a password of at least 10 characters with uppercase, lowercase, numeric, and non-alphanumeric characters.
- Login returns an HttpOnly `transitops_access` JWT cookie. The cookie expires after 30 minutes; no refresh-token flow is implemented. Logout clears the cookie. HTTPS is required outside Development.
- Login is locked for 15 minutes after five failed password attempts. The authentication endpoints also have an IP-based request limit.
- Development demo accounts share the configured password: `admin@transitops.com`, `manager@transitops.com`, `driver@transitops.com`, `safety@transitops.com`, and `analyst@transitops.com`.
- The Organization Admin dashboard creates tenant-scoped Fleet Manager, Driver, Safety Officer, and Financial Analyst accounts. Creating a Driver also creates and links the required driver profile.
- Initial production Organization Admin provisioning after a software purchase is not yet connected to a billing provider. Only trusted provisioning should create that first admin; public users cannot self-register or assign themselves a role.
- The app guards its `/admin` and operational paths by authenticated role, and the API enforces authorization independently.

## API and tools

- Swagger: `http://localhost:5000/swagger` (when enabled for the current environment)
- SignalR: `http://localhost:5000/hubs/transitops`
- Postman collection: import [`postman_collection.json`](../postman_collection.json). Use the same host as `baseUrl`, configure the Development demo login, then log in. Postman should retain the HttpOnly cookie in its cookie jar; bearer-token headers are not used.
- Reports: endpoints are protected by role policies. CSV and PDF services use CsvHelper and QuestPDF.
- Financial Analysts can download a QuestPDF financial ledger from Reports; Fleet Managers and Drivers can download a QuestPDF turn-in receipt for completed trips.
- Fleet Managers can download a QuestPDF vehicle ROI summary. It includes the fleet dashboard counts/utilization and averages for completed-trip revenue and distance, operating cost/profit per vehicle, and vehicle ROI. Vehicle ROI is operating profit (completed-trip revenue minus maintenance and fuel) divided by acquisition cost; capital cost is not deducted again as an operating expense.
- Hangfire dashboard: available to authenticated Fleet Managers only.

For the role/resource permissions and KPI formulas currently implemented, see [`ACCESS_AND_KPI.md`](./ACCESS_AND_KPI.md). That document also calls out unresolved Driver-versus-Dispatcher and driver-to-identity assignment decisions.
