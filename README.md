# TransitOps

Fleet operations platform for Indian transport companies: vehicles, drivers, trip dispatch, maintenance, expenses, safety compliance and financial reporting, sold as a multi-tenant SaaS with Razorpay checkout.

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind, SignalR client |
| Backend | ASP.NET Core 10 Web API, SignalR, FluentValidation, Hangfire |
| Data | PostgreSQL (Supabase) via Entity Framework Core |
| Auth | ASP.NET Core Identity, JWT in an HttpOnly cookie, role-based access |
| Reports | CsvHelper, QuestPDF |

## Repository layout

```
backend/                     ASP.NET Core solution (TransitOps.sln)
  TransitOps.Api/            Controllers, SignalR hub, startup, Postman collection
  TransitOps.Application/    DTOs, validators, report generators, service interfaces
  TransitOps.Domain/         Entities and enums
  TransitOps.Infrastructure/ EF Core DbContext + migrations, services, Hangfire jobs
  TransitOps.Tests/          xUnit tests
frontend/                    React app and the Express dev host (server.ts)
database/                    Supabase row-level-security scripts
docs/                        Setup guide, access & KPI rules, handoff guide, UML diagrams, test report
tests/api/                   End-to-end API checklist tests (Python, standard library only)
tools/                       Portable test database, local mail catcher, test API launcher
```

## Quick start

Prerequisites: .NET SDK 10, Node.js 20+, and a PostgreSQL connection string (a Supabase project works).

1. Store backend secrets once with .NET User Secrets. See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for every key; the minimum is the connection string, `Jwt:Key` and `DemoAccounts:Password`.
2. Start the API (http://localhost:5000, Swagger at `/swagger`):
   ```
   dotnet run --project backend/TransitOps.Api/TransitOps.Api.csproj
   ```
3. In a second terminal, start the frontend (http://localhost:3000):
   ```
   npm --prefix frontend install
   npm --prefix frontend run dev
   ```
4. In Development the API seeds a demo organization. Sign in as `admin@`, `manager@`, `driver@`, `safety@` or `analyst@transitops.com` with your configured demo password.

End-to-end API checks against a disposable local database are in [tests/api](tests/api/README.md); the latest results are in [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

Run the checks that CI runs:

```
dotnet test backend/TransitOps.sln
npm --prefix frontend run lint
```

## Documentation

- [Setup guide](docs/SETUP_GUIDE.md): secrets, Supabase, Razorpay test mode, ngrok
- [Access model and KPI definitions](docs/ACCESS_AND_KPI.md): permission matrix, KPI/ROI formulas, safety score, Indian licence and registration rules
- [Developer handoff](docs/DEVELOPER_HANDOFF.md): file-by-file catalog and request flows
- [UML diagrams](docs/uml/README.md): open `docs/uml/uml-viewer.html` in a browser

Never commit secrets: keep them in User Secrets locally and in the host's secret store in production.
