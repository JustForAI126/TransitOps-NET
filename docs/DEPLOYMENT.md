# Deployment

TransitOps deploys as **one container**: the `Dockerfile` at the repository root builds the React app and
serves it from the ASP.NET Core API, so the UI, the REST API (`/api`) and SignalR (`/hubs`) share one HTTPS
origin. The database stays on Supabase.

```
Browser ──HTTPS──▶ Render web service (Docker) ──TLS──▶ Supabase PostgreSQL (session pooler)
                     ├─ React app (wwwroot)        └─▶ Razorpay (Test Mode), Gmail SMTP
                     ├─ /api, /hubs (SignalR)
                     └─ Hangfire jobs
```

Why one service instead of Vercel + a separate API: the login cookie is HttpOnly and `SameSite=Lax`. A frontend
on `*.vercel.app` calling an API on another site turns it into a third-party cookie, which Safari and newer
Chrome block. Vercel's proxy rewrites do not carry WebSockets, so SignalR would also degrade.

## Our live deployment

| | |
|---|---|
| Live site | https://transitops-s0vg.onrender.com |
| Hosting | Render, free web service, region Singapore, Docker, branch `main` |
| Created from | **Public Git Repository** (`https://github.com/JustForAI126/TransitOps-NET`), so no GitHub app approval was needed. Render does not redeploy on push: after merging to `main`, click **Manual Deploy → Deploy latest commit**. |
| Database | The existing Supabase project (session pooler, Mumbai), shared with the development laptops |
| Health check | `/api/health` |

Environment variables set in Render (values are in Render, never in Git):

| Variable | Value / note |
|---|---|
| `ConnectionStrings__DefaultConnection` | Key=value form with a smaller pool, so one laptop plus Render stay under the pooler's 15 connections: `Host=aws-0-ap-south-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<db password>;SSL Mode=Require;Maximum Pool Size=6` |
| `Jwt__Key` | At least 32 characters |
| `DemoData__Enabled` | `true` |
| `DemoAccounts__Password` | **The same value as `DemoAccounts:Password` in the laptops' User Secrets.** Every start resets the demo accounts to this password; different values on the laptop and on Render make them overwrite each other. |
| `Razorpay__KeyId`, `Razorpay__KeySecret`, `Razorpay__WebhookSecret` | Razorpay Test Mode keys |
| `Email__Smtp__*` | Brevo: Host `smtp-relay.brevo.com`, Port `2525`, EnableSsl `true`, UserName = the Brevo SMTP login (`...@smtp-brevo.com`), Password = the Brevo SMTP key, FromAddress = **the email the Brevo account was created with** (or another address added and confirmed under Brevo → Senders). Render's free plan blocks port 587, so Gmail cannot be used there. |

Rules for the shared database: run **at most one laptop** against Supabase while the live site is up, and try
destructive experiments in the offline test mode (`Start TransitOps (test mode).cmd`), not on Supabase.

### Problems we hit and how they were fixed

| Log message | Cause | Fix |
|---|---|---|
| `Format of the initialization string does not conform to specification starting at index 0` | The connection string value had something before it (space, quote or the JSON key) | Paste only `Host=...` to `...Pool Size=6`. The app now trims spaces and quotes and explains the expected format. |
| `Jwt:Key must contain at least 32 UTF-8 bytes` | `Jwt__Key` was empty or short | Set a 32+ character key |
| `28P01: password authentication failed for user "postgres"` | A typo in the pasted connection string | Delete the variable and add it again by copy-paste |
| Demo login fails on the live site | `DemoAccounts__Password` on Render differed from the laptop's | Use the same value in both places |
| `5.7.0 Please authenticate first` (no email arrives) | .NET's built-in `System.Net.Mail.SmtpClient` never logs in to Brevo | The app now sends email with MailKit, which authenticates correctly with Brevo and Gmail |
| API says the code was sent, but no email arrives and Brevo shows no delivery | `Email__Smtp__FromAddress` was not a verified Brevo sender, so Brevo silently dropped the mail | Set it to the Brevo sign-up email, or verify the address under Brevo → Senders |

## 1. Database (Supabase)

Use a **separate Supabase project for the deployed app**. Do not point the deployment at the database your
laptops use for development: the deployed app seeds the demo organization and runs migrations on startup.

1. supabase.com → New project (region: Mumbai `ap-south-1`). Save the database password in your password manager.
2. Connect → **Session pooler** → copy the URI. It looks like
   `postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`.
   The app converts this URI format itself.
3. Optional: run `database/supabase-rls-setup.sql` in the SQL editor to switch on row-level security
   without public policies. The API connects as the table owner and is not affected.

The first start creates every table, applies migrations and, with `DemoData__Enabled=true`, seeds the demo
organization (12 vehicles, 12 drivers, about 120 trips) and the five demo logins.

## 2. Web service (Render)

The repository includes `render.yaml`, a Render Blueprint.

1. render.com → sign in with GitHub. Render needs access to this repository: the repository owner installs the
   Render GitHub app for it, or deploys it from their own Render account.
2. New → **Blueprint** → choose the repository. Render reads `render.yaml`.
3. Fill in the values it asks for:

   | Variable | Value |
   |---|---|
   | `ConnectionStrings__DefaultConnection` | Supabase session pooler URI from step 1 |
   | `PublicApplication__BaseUrl` | The service URL, e.g. `https://transitops.onrender.com` (used in emailed links) |
   | `Cors__AllowedOrigins__0` | The same URL |
   | `DemoAccounts__Password` | A new strong password for the demo logins (10+ characters, upper, lower, digit, symbol) |
   | `Razorpay__KeyId` / `Razorpay__KeySecret` / `Razorpay__WebhookSecret` | Razorpay **Test Mode** keys |
   | `Email__Smtp__UserName` / `Email__Smtp__FromAddress` | The Gmail address that sends mail |
   | `Email__Smtp__Password` | A Gmail **app password** (Google Account → Security → App passwords) |

   `Jwt__Key` is generated by Render. `ReverseProxy__TrustAllProxies` is set in the image so cookies are
   `Secure` and rate limiting sees real client IPs behind Render's proxy.
4. Create. The first build takes several minutes; the health check is `GET /api/health`.
5. Once the URL is known, enter it in `PublicApplication__BaseUrl` and `Cors__AllowedOrigins__0` if you had
   left them empty, and redeploy.

Free-plan services sleep after 15 minutes without traffic and take about a minute to wake. Open the site a
few minutes before a demonstration. Hangfire's daily jobs run only while the service is awake.

## 3. Razorpay webhook

Razorpay Dashboard (Test Mode) → Settings → Webhooks → Add:

- URL: `https://<your-service>/api/onboarding/webhook/razorpay`
- Events: `payment.captured`, `payment.failed`
- Secret: the same value as `Razorpay__WebhookSecret`

With a stable Render URL, ngrok is only needed for local webhook testing.

## 4. Check the deployment

1. `https://<your-service>/api/onboarding/plans` returns the three plans.
2. Sign in as `manager@transitops.com` with the demo password; the dashboard shows the seeded fleet.
3. Refresh on `/vehicles`: the page stays on Vehicles.
4. Buy a plan with a [Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-details/):
   the receipt email arrives with the PDF attached, followed by the account setup email.

## Secrets

All secrets live in Render's environment settings, never in the repository. If a secret was ever shared in
chat or as a file, rotate it before deploying: Supabase database password, Gmail app password, Razorpay
keys and webhook secret.

## Running the production build locally

Without Docker, `tools/run-api-testdb.ps1` and `tests/api/README.md` describe the local test setup. With
Docker:

```
docker build -t transitops .
docker run -p 8080:8080 -e ConnectionStrings__DefaultConnection=... -e Jwt__Key=... -e DemoData__Enabled=true -e DemoAccounts__Password=... transitops
```

CI builds this image on every pull request.
