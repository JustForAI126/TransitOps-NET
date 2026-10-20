# TransitOps Setup Guide

For the complete directory catalog, application flow, business rules, and developer handoff notes, see [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md).

TransitOps uses a React/Vite client, an ASP.NET Core Web API, PostgreSQL through EF Core, ASP.NET Core Identity with JWT cookies, SignalR, FluentValidation, Hangfire, CsvHelper, and QuestPDF. The Express server is a development/full-stack host and API bridge; PostgreSQL-backed ASP.NET Core is the only application API and data store.

## Prerequisites

- Node.js 20+ and npm 10+
- .NET SDK 10
- PostgreSQL 15+ (or a Supabase PostgreSQL database)

## Collaborating with another developer

Share the Git repository and this setup guide; **do not send secret-bearing files alongside it**. Each developer should clone the repository, install dependencies, and configure their own local settings. The repository's `.gitignore` excludes local `.env` files, `backend\ngrok.yml`, and build outputs; these files are not collaboration templates and should not be force-added.

| Setting or file | What to do for the other developer |
|---|---|
| `frontend\.env.example` | Already tracked; use it as the non-secret frontend template. Copy it to `frontend\.env` locally only if custom host/port values are needed. |
| `backend\TransitOps.Api\appsettings.json` | Already tracked and contains non-secret defaults and plan catalog. Do not put credentials in it. |
| `.NET User Secrets` | Not part of the repository and stored per Windows user. Give the developer the required development values through an approved password manager/secret vault, then have them run the setup commands below on their own machine. Never export or send `secrets.json`. |
| Database/PostgreSQL | Prefer a separate development database and database login per developer. If a shared development database is necessary, share only its development connection string through the secret vault; never use production credentials for local development. |
| Razorpay | Use Test Mode only. Invite the developer to the Razorpay account with an individual account and least-privilege dashboard access when needed. Otherwise, have the account owner perform dashboard changes. Share API/webhook test secrets only through the secret vault and only if the developer needs to run checkout locally. |
| SMTP/Gmail | Prefer an individual test sender or a dedicated team mailbox with a revocable app password. Never share a personal Gmail password. Share an app password through the secret vault only when required. |
| ngrok | Each developer should register their own ngrok auth token. The token may be stored in the ignored local `backend\ngrok.yml`, but do not share that secret-bearing file in Git or chat. A reserved hostname can only be used by accounts authorized for that ngrok domain. |
| Application logins | Create an individual Fleet Manager/Driver/etc. account for the developer in the development tenant when possible. A shared demo login is for local development only; do not reuse it for Razorpay, Gmail, ngrok, Git hosting, or database access. |

**Do not reuse one password or credential across services.** Individual accounts preserve audit trails and let you revoke access without disrupting the other developer. If credentials have already been committed, pasted into chat, or included in a shared file, treat them as exposed: revoke/rotate them with the issuing provider before collaboration. Store shared development secrets in an access-controlled vault, enable MFA on provider accounts, and rotate/remove access when the collaboration ends.

To configure the API on the second developer's machine, use the existing User Secrets setup in the next section and enter the values they are authorized to use. For example, from the repository root:

```powershell
$apiProject = "backend\TransitOps.Api\TransitOps.Api.csproj"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<development-database-connection-string>" --project $apiProject
$jwtKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
dotnet user-secrets set "Jwt:Key" $jwtKey --project $apiProject
dotnet user-secrets set "DemoAccounts:Password" "<unique-strong-development-password>" --project $apiProject
```

The JWT signing key can be unique per developer; it does not need to match. The demo password should match the local API's seed configuration only if that developer intends to log in to the seeded demo accounts. Add Razorpay and SMTP settings only when testing those integrations. Do not paste actual secret values into this guide, Git, email, or chat.

## Configure and run locally

1. Install the JavaScript dependencies:

   ```powershell
   npm --prefix frontend install
   ```

2. Save backend secrets once with .NET User Secrets. The API project loads them automatically in Development. User Secrets are stored outside the repository, so you do not need to set environment variables each time you run the API. They are a local-development convenience, not an encrypted production secret store; use your deployment platform's secret manager in production.

   ```powershell
   $apiProject = "backend\TransitOps.Api\TransitOps.Api.csproj"
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=transitops;Username=transitops_app;Password=<your-db-password>;SSL Mode=Prefer" --project $apiProject
   $jwtKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   dotnet user-secrets set "Jwt:Key" $jwtKey --project $apiProject
   dotnet user-secrets set "DemoAccounts:Password" "<strong-development-password>" --project $apiProject
   dotnet user-secrets set "Razorpay:KeyId" "rzp_test_..." --project $apiProject
   dotnet user-secrets set "Razorpay:KeySecret" "<razorpay-test-secret>" --project $apiProject
   dotnet user-secrets set "Razorpay:WebhookSecret" "<razorpay-webhook-secret>" --project $apiProject
   dotnet user-secrets set "Email:Smtp:Host" "<smtp-host>" --project $apiProject
   dotnet user-secrets set "Email:Smtp:Port" "587" --project $apiProject
   dotnet user-secrets set "Email:Smtp:EnableSsl" "true" --project $apiProject
   dotnet user-secrets set "Email:Smtp:UserName" "<smtp-user>" --project $apiProject
   dotnet user-secrets set "Email:Smtp:Password" "<smtp-password>" --project $apiProject
   dotnet user-secrets set "Email:Smtp:FromAddress" "<verified-sender-email>" --project $apiProject
   ```

   Replace the database, demo, Razorpay, and SMTP placeholders with private values. Razorpay checkout is deliberately restricted to Test Mode key IDs beginning `rzp_test_`; a missing or live key cannot create or verify a payment. SMTP must be configured for email verification, receipts, and account setup. Identity requires the demo password to be at least 10 characters and contain uppercase, lowercase, numeric, and non-alphanumeric characters. The generated JWT key is saved to User Secrets.

   For Supabase instead of local PostgreSQL, use the **Session pooler** connection string from the Supabase Dashboard's Connect panel if the direct database host is unreachable over IPv6:

   ```powershell
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<Supabase Session pooler connection string>" --project $apiProject
   ```

   The API limits its Npgsql connection pool to 8 connections and Hangfire to 2 workers, leaving headroom under Supabase Session pooler's 15-client limit. Run only one local API instance against a small session pool. After changing this connection-pool configuration, restart the API; if another API terminal is still running, stop it before starting the replacement.

   `Jwt:Issuer`, `Jwt:Audience`, `Cors:AllowedOrigins`, and the API URL are non-secret defaults in `backend\TransitOps.Api\appsettings.json` and `backend\TransitOps.Api\Properties\launchSettings.json`. Change `Cors:AllowedOrigins` there if your frontend uses a different origin. Do not put service-role keys or database passwords in `VITE_*` variables; browser code must not connect directly to PostgreSQL.

3. Start the API:

   ```powershell
   dotnet run --project backend\TransitOps.Api\TransitOps.Api.csproj
   ```

   The launch profile selects Development and `http://localhost:5000` automatically. Saved User Secrets are loaded on each run.

4. In a second terminal, start the React client and Express bridge:

   ```powershell
   npm --prefix frontend run dev
   ```

   Open `http://localhost:3000`. API requests and SignalR traffic are proxied to the ASP.NET Core service. Keep both the API and frontend terminals running while using the app.

   For ordinary local development, these two terminals are enough. To test Razorpay checkout and receive its webhooks, also run ngrok in a third terminal as described below. Start ngrok only after the API is listening, and keep all three terminals open during testing.

   Frontend source, configuration, package manifests, and its local environment files live in `frontend\`. `npm --prefix frontend ...` lets you run the frontend scripts from the repository root; alternatively, change directory to `frontend\` first and run the same npm scripts there.

   If the frontend logs a `Premature close` while a browser request is being cancelled or navigated away from, the bridge treats that as a disconnected client and cancels the upstream request without reporting the API as unavailable. It also omits upstream content lengths when streaming responses, since response decompression can change the byte count. For a genuine `502 API unavailable`, check that the API is listening at `http://localhost:5000` and inspect the ASP.NET Core console for startup or database errors.

## Expose the API to Razorpay with ngrok

Razorpay must be able to reach the backend webhook endpoint from the public internet. Each developer creates their own ignored `backend\ngrok.yml` locally; it exposes only the ASP.NET Core API on port `5000`, not the frontend or PostgreSQL.

1. Install ngrok from its official download page or with Windows Package Manager:

   ```powershell
   winget install --id Ngrok.Ngrok -e --source winget
   ```

   The Winget package ID is `Ngrok.Ngrok` (the lowercase `ngrok.ngrok` ID is not listed in the current Winget source). Open a new terminal after installation and confirm `ngrok version` works.

2. Create an ngrok account and copy its auth token from the ngrok dashboard. Register it once in the local ngrok configuration:

   ```powershell
   ngrok config add-authtoken "<YOUR_NGROK_AUTHTOKEN>"
   ```

   Replace the placeholder locally. This stores the token in your user profile. Each developer should use their own token when possible. If the `ngrok start --config ...` command requires the token in the specified config, add it under `agent.authtoken` in the ignored local `backend\ngrok.yml`. Never commit the token.

   Create `backend\ngrok.yml` locally with the following configuration (the file is ignored by Git and may contain a secret):

   ```yaml
   version: 3
   agent:
     authtoken: "<YOUR_NGROK_AUTHTOKEN>"
   endpoints:
     - name: transitops-api
       url: https://<your-authorized-ngrok-domain>
       upstream:
         url: http://localhost:5000
   ```

   Replace the token and example domain locally. The token belongs under `agent.authtoken` in this ngrok v3 config. Keep the real value out of the Git repository. `.gitignore` prevents Git from adding an untracked file, but does not protect a copy sent through WhatsApp or remove a file that was already committed. Prefer giving the other developer their own ngrok account/token; if the same account must be used, transfer the token through an access-controlled password manager's secret-sharing feature, not a chat attachment.

3. With the API already running in the first terminal, open a third PowerShell terminal at the repository root and start the configured tunnel:

   ```powershell
   ngrok start --config backend\ngrok.yml transitops-api
   ```

   Keep this terminal open while testing. Ngrok prints a public HTTPS forwarding address, such as `https://example-name.ngrok-free.app`. Confirm the API is reachable at `https://example-name.ngrok-free.app/api/onboarding/plans` (it should return the plan list) before configuring Razorpay.

   If you have reserved `empathic-valiant-reach.ngrok-free.dev` in your ngrok account and want to use that fixed hostname, start the API tunnel directly instead:

   ```powershell
   ngrok http 5000 --domain=empathic-valiant-reach.ngrok-free.dev
   ```

   Use the exact reserved hostname assigned to your account. `--domain` is the flag for this ngrok CLI; `--url` is not supported. Forward port `5000` because that is where the ASP.NET Core API listens. Port `80` is not the TransitOps API port.

4. In the Razorpay Test Mode dashboard, configure the webhook URL using the forwarding hostname printed by ngrok:

   ```text
   https://<ngrok-hostname>/api/onboarding/webhook/razorpay
   ```

   Subscribe to `payment.captured` and `payment.failed`. Set a webhook secret in Razorpay, then save the same value as the backend `Razorpay:WebhookSecret` using .NET User Secrets. This webhook secret is separate from the ngrok auth token and Razorpay API key secret.

5. Free ngrok URLs normally change when a tunnel restarts. Update the webhook URL in Razorpay each time the hostname changes, or use a reserved ngrok domain if your ngrok plan supports one. Leave the API and ngrok tunnel running during checkout/webhook testing. Razorpay webhook signatures and event IDs are verified server-side; the tunnel does not bypass those checks.

Ngrok is not installed by this repository. If the `ngrok` command is unavailable, install it first; if the tunnel reports an authentication error, complete step 2. Do not expose the API through an unauthenticated general-purpose tunnel in production—use a stable, managed HTTPS deployment endpoint instead.

## Database initialization

The API requires PostgreSQL and fails startup if the connection string or JWT configuration is missing. Startup calls `EnsureCreated()` to initialize a fresh database, then applies additive EF Core migrations. The onboarding migrations create only organization/subscription/purchase tables and the verification resend counter; their SQL is idempotent for schemas initialized by `EnsureCreated()`. No existing demo or operational tables are dropped or reset. Review and back up a production database before applying any schema change.

The database connection must be held only by the backend. Tenant filtering and role authorization are enforced by API endpoints. If using Supabase, use the SQL scripts only to enable RLS without public policies; they deliberately do not install permissive `USING (true)` policies. The configured backend database principal must be able to perform its trusted server-side operations. Never expose a database password, service-role key, or unrestricted policy to the browser.

## Authentication, demo accounts, and organization administration

- The public UI and API do not provide registration. Users must be created by an Organization Admin so every account belongs to its fleet organization.
- In Development, startup seeds the demo tenant's sample fleet data and demo accounts. `DemoAccounts:Password` is required in Development and should be stored in .NET User Secrets; it is synchronized to the seeded demo accounts on each startup so the configured password remains usable. Sample records are only seeded in Development.
- Seed data belongs to the `demo_tenant`, not to individual identities. Accounts created by the demo Organization Admin join that same demo organization and share its seeded workspace. Paid onboarding creates a unique tenant for each newly purchased organization; new organizations do not receive the demo fleet seed data.
- Development sample data is added idempotently: 12 vehicles, 12 drivers, 120 historical trips plus the active demo dispatch, 24 maintenance records, and trip/overhead expenses. The landing page is available at `/`; unauthenticated requests to operational paths are redirected to `/login`.
- Identity requires a password of at least 10 characters with uppercase, lowercase, numeric, and non-alphanumeric characters.
- Login returns an HttpOnly `transitops_access` JWT cookie. The cookie expires after 30 minutes; no refresh-token flow is implemented. Logout clears the cookie. HTTPS is required outside Development.
- Login is locked for 15 minutes after five failed password attempts. The authentication endpoints also have an IP-based request limit.
- Development demo accounts share the configured password: `admin@transitops.com`, `manager@transitops.com`, `driver@transitops.com`, `safety@transitops.com`, and `analyst@transitops.com`.
- The Organization Admin dashboard creates, edits, and deletes tenant-scoped Fleet Manager, Driver, Safety Officer, and Financial Analyst accounts. Editing updates the account's name, email, and built-in role; assigning Driver also requires license/contact details. The paid Organization Admin account is protected from edits and deletion. Deleting a Driver account revokes sign-in but retains its driver profile and trip history.
- The public purchase flow creates the first Organization Admin only after verified payment and single-use account setup. Customers cannot self-assign roles or receive platform Superadmin privileges.
- The app guards its `/admin` and operational paths by authenticated role, and the API enforces authorization independently.

### SaaS purchase and account onboarding (Razorpay Test Mode)

- Start at `http://localhost:3000/` and select **Choose a plan**. The purchaser submits organization name, full name, and email, then verifies a time-limited code sent by SMTP.
- Plan IDs, prices, and feature lists are server-owned under `SaasOnboarding:Plans` in `backend\TransitOps.Api\appsettings.json`; the public homepage loads and displays this catalog. The current editable sample catalog is Essential ₹2,999, Growth ₹7,499, and Enterprise ₹19,999, each for one month. These are provisional INR test-mode prices, not a researched or approved commercial price list.
- Checkout is a **one-time charge for a fixed one-month term**; there is no automatic renewal or recurring Razorpay Subscription. Change plan names/prices/term only in backend configuration.
- The backend creates the Razorpay order from the configured amount. It accepts only an `rzp_test_` Key ID, validates checkout HMAC, then fetches the payment from Razorpay and requires matching order, amount, INR currency, and `captured` status before recording a payment or provisioning a tenant.
- Test Mode simulates payment authorization; it does not charge a real wallet or guarantee delivery of an actual MobiKwik OTP. For a documented test flow, use a Razorpay test card and the mock bank page's simulated OTP. See [Razorpay test card details](https://razorpay.com/docs/payments/payments/test-card-details/) and [supported wallets](https://razorpay.com/docs/payments/payment-methods/wallets/). Availability of MobiKwik in the checkout UI does not mean a real wallet OTP will be delivered in Test Mode.
- Configure a Razorpay webhook in Test Mode to `https://<public-api-host>/api/onboarding/webhook/razorpay` for `payment.captured` and `payment.failed`, using the same secret as `Razorpay:WebhookSecret`. Signature validation and unique event IDs make webhook re-delivery idempotent; browser callback verification is also server-side.
- After payment verification, PostgreSQL records the organization and paid subscription transactionally. Purchase email receipt and the single-use, 48-hour account setup link are sent only to the verified email. The customer chooses a password on the site; it is never emailed. Setup creates an Identity user with only the tenant-scoped `OrganizationAdmin` role.
- If the browser cannot reach the API after Razorpay Checkout returns, the checkout response is temporarily kept in that tab's `sessionStorage`; reopening the purchase page retries server-side verification. The server still validates the Razorpay signature and fetches the captured payment before recording success.
- Failed/cancelled checkouts do not create an organization or subscription. A captured payment that cannot be verified because the API is temporarily unavailable must be retried or delivered through the signed webhook. If SMTP delivery fails after payment, the purchase remains recorded and the checkout page can retry receipt/setup email delivery; the purchase capability is held in browser session storage, not persisted as a password or token in the database.
- The backend does not claim payment success if Razorpay credentials are absent or status cannot be confirmed. If SMTP settings are absent, email-verification endpoints return a configuration error; if email delivery fails transiently, the response indicates retry is needed.
- In Development, use .NET User Secrets for `Razorpay:KeyId`, `Razorpay:KeySecret`, `Razorpay:WebhookSecret`, and `Email:Smtp:*`. The non-secret plan catalog and `PublicApplication:BaseUrl` are in `appsettings.json`. Never put Razorpay secrets or SMTP passwords in frontend `.env`, `VITE_*`, source control, or browser code.

## API and tools

- Swagger: `http://localhost:5000/swagger` (when enabled for the current environment)
- SignalR: `http://localhost:5000/hubs/transitops`
- Postman collection: import [`postman_collection.json`](../backend/TransitOps.Api/postman_collection.json) (also downloadable from `GET /api/docs/postman`). Use the same host as `baseUrl`, configure the Development demo login, then log in. Postman should retain the HttpOnly cookie in its cookie jar; bearer-token headers are not used.
- Reports: endpoints are protected by role policies. CSV and PDF services use CsvHelper and QuestPDF.
- Financial Analysts can download a QuestPDF financial ledger from Reports; Fleet Managers can download turn-in receipts for tenant trips, and Drivers can download receipts only for their own assigned trips.
- Fleet Managers can download a QuestPDF vehicle ROI summary. It includes the fleet dashboard counts/utilization and averages for completed-trip revenue and distance, operating cost/profit per vehicle, and vehicle ROI. Vehicle ROI is operating profit (completed-trip revenue minus maintenance and fuel) divided by acquisition cost; capital cost is not deducted again as an operating expense.
- Hangfire dashboard: available to authenticated Fleet Managers only.

For the role/resource permissions and KPI formulas currently implemented, including linked-driver trip restrictions, see [`ACCESS_AND_KPI.md`](./ACCESS_AND_KPI.md).
