# TransitOps Setup & Deployment Guide

TransitOps is an enterprise-grade Smart Transport Operations Platform built with React, Vite, Tailwind CSS, SignalR, ASP.NET Core 10 Web API, Entity Framework Core, Supabase (PostgreSQL), and Hangfire.

---

## 1. System Requirements & Prerequisites

- **Node.js**: Version 20+ or 22+ LTS
- **npm**: Version 10+
- **.NET SDK**: .NET 10 (Preview/Release) for compiling the C# ASP.NET Core solution
- **Docker**: Version 24+ (optional, for containerized deployments)
- **Supabase / PostgreSQL**: Any Supabase project or PostgreSQL 15+ database

---

## 2. Project Architecture Overview

```
├── backend/
│   ├── TransitOps.sln
│   ├── Dockerfile                           # Multi-stage .NET 10 Docker build
│   ├── TransitOps.Domain/                   # Clean Architecture entities & enums
│   ├── TransitOps.Application/              # DTOs, FluentValidation, CsvHelper, QuestPDF
│   ├── TransitOps.Infrastructure/           # EF Core DbContext (Supabase), Hangfire jobs
│   └── TransitOps.Api/                      # ASP.NET Core 10 Web API, SignalR Hub, Swagger
├── src/                                     # React 19 SPA (Vite + Tailwind CSS)
│   ├── components/                          # Dashboard, views, modals, toasts
│   ├── context/                             # AppContext (state & multi-tenancy), ThemeContext
│   ├── services/                            # SignalR client, Supabase client, REST API
│   └── utils/                               # Currency formatter (₹ INR), calculations
├── server.ts                                # Express full-stack host & SignalR protocol bridge
├── postman_collection.json                  # Complete Postman API collection
└── package.json                             # Root scripts & dependencies
```

---

## 3. Quick Start (Development Full-Stack Mode)

The application includes an Express full-stack server with Vite middleware that runs on **port 3000** and serves both the frontend SPA and all REST & SignalR API endpoints out of the box.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy the example environment template:
```bash
cp .env.example .env
```
Key configuration parameters in `.env`:
```env
PORT=3000
JWT_SECRET=TransitOpsSuperSecretProductionEncryptionKey2026!#$*
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Run the Application
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 4. Running the .NET 10 Web API Backend Directly

To run the native C# ASP.NET Core 10 backend:

### Step 1: Navigate to the Backend Directory
```bash
cd backend
```

### Step 2: Configure Supabase Connection in `appsettings.json`
Edit `TransitOps.Api/appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=aws-0-ap-south-1.pooler.supabase.com;Port=6543;Database=postgres;Username=postgres.YOUR_PROJECT_REF;Password=YOUR_DATABASE_PASSWORD;SSL Mode=Require;Trust Server Certificate=true"
  },
  "Supabase": {
    "Url": "https://YOUR_PROJECT_ID.supabase.co",
    "Key": "YOUR_SUPABASE_ANON_KEY"
  },
  "Jwt": {
    "Key": "TransitOpsSuperSecretProductionEncryptionKey2026!#$*EnterpriseLevelTokenSigningSecret",
    "Issuer": "TransitOpsApi",
    "Audience": "TransitOpsClient"
  }
}
```

> **Important Supabase Password Clarification**:
> - In `YOUR_DATABASE_PASSWORD`, enter your **Supabase Database Password** (the password you created when creating your Supabase project under Project Settings -> Database). This is NOT your Supabase website account login password.
> - If you forgot your database password, you can reset it instantly in Supabase: **Project Settings -> Database -> Database Password -> Reset Password**.
> - **Connection Options**:
>   - **Session / Transaction Pooler (Port 6543 - Recommended)**:
>     `Host=aws-0-[region].pooler.supabase.com;Port=6543;Database=postgres;Username=postgres.[project-ref];Password=[database-password];SSL Mode=Require;Trust Server Certificate=true`
>   - **Direct Connection (Port 5432)**:
>     `Host=db.[project-ref].supabase.co;Port=5432;Database=postgres;Username=postgres;Password=[database-password];SSL Mode=Require;Trust Server Certificate=true`

---

## 5. Resolving Supabase 'UNRESTRICTED' Table Status

### Why does Supabase show 'UNRESTRICTED'?
In Supabase Studio under the **Table Editor**, tables created without active Row Level Security (RLS) display an orange warning badge: `UNRESTRICTED`. This warns that queries from public API keys are not restricted by row-level filters.

### 1-Click Fix via Supabase SQL Editor:
1. Open your project at [app.supabase.com](https://app.supabase.com).
2. Click **SQL Editor** on the left navigation bar -> Click **+ New Query**.
3. Open `SUPABASE_RLS_FIX.sql` (located in the project root and in `backend/SUPABASE_RLS_FIX.sql`).
4. Paste the SQL content into the editor and click **Run**.
5. Return to the **Table Editor**: All tables will now display the green **`RLS ENABLED (1 policy)`** status badge!

The .NET backend also automatically applies this RLS policy when connecting to Supabase on startup.

---

## 6. Running the Application
```bash
dotnet restore TransitOps.sln
dotnet run --project TransitOps.Api/TransitOps.Api.csproj
```
- API Base URL: `http://localhost:5000` (or `https://localhost:5001`)
- Swagger Documentation: `http://localhost:5000/swagger`
- Hangfire Dashboard: `http://localhost:5000/hangfire`
- SignalR Hub: `http://localhost:5000/hubs/transitops`

---

## 5. Docker Deployment

A multi-stage Dockerfile is provided in `backend/Dockerfile` targeting .NET 10:

### Build Image
```bash
docker build -t transitops-backend -f backend/Dockerfile backend/
```

### Run Container
```bash
docker run -d -p 3000:3000 \
  -e ConnectionStrings__DefaultConnection="Host=db.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=YOUR_PASSWORD;SSL Mode=Require" \
  --name transitops-api \
  transitops-backend
```

---

## 6. Authentication & Demo Accounts

TransitOps enforces role-based access control (RBAC) and strict tenant isolation:

| Role | Demo Email | Notes |
| :--- | :--- | :--- |
| **Fleet Manager** | `manager@transitops.com` | Full operational control, asset assignment, dispatch |
| **Driver** | `driver@transitops.com` | Driver cockpit, assigned trips, odometer log |
| **Safety Officer** | `safety@transitops.com` | Compliance inspection, driver scorecards, licenses |
| **Financial Analyst** | `analyst@transitops.com` | ROI matrix, fuel & maintenance OPEX analytics (₹) |

> **Tenant Isolation Rule**: Seeded demo fleet data is only visible to `@transitops.com` demo accounts. Any new account created through the registration form receives an isolated tenant with a clean workspace.

---

## 7. API Documentation & Postman Collection

1. **Postman Collection**:
   Import `postman_collection.json` into Postman to test authentication, vehicles, drivers, trips, maintenance, expenses, and KPI endpoints.
   Or download via the API:
   ```bash
   curl -O http://localhost:3000/api/docs/postman
   ```

2. **OpenAPI / Swagger Specification**:
   Inspect OpenAPI 3.0 definitions at:
   ```bash
   http://localhost:3000/api/docs/swagger.json
   ```

---

## 8. Export & Report Services

- **CSV Export**: Trips (`/api/export/trips/csv`) and Vehicle ROI Matrix (`/api/export/roi/csv`).
- **QuestPDF & CsvHelper**: Built into `TransitOps.Application/Reports` for generating PDF manifest sheets and standard compliant CSV reports.
- **Currency**: All financial values are calculated and rendered in Indian Rupees (`₹ INR`).
