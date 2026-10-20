# Test report: checklist (test.md), 20 Oct 2026

Run against a fresh, empty PostgreSQL database with the Development seed, using `tests/api/checklist.py`
(see `tests/api/README.md`), plus manual browser checks. The shared Supabase database was not touched.

**Result: 199 automated checks passed, 0 failed.** 68 unit tests pass. 4 notes, 7 manual checks.

| Section | Automated | Notes |
|---|---|---|
| 1.1 Registration / user provisioning | 15 pass | Public sign-up is disabled by design; Organization Admin creates users |
| 1.2 Login, session, brute force | 19 pass | 2 notes (below) |
| 2 Role-based access control | 28 pass | 13 endpoints × 5 roles, field redaction, driver trip scoping |
| 3 Dashboard KPIs | 7 pass | 1 note |
| 4 Vehicles | 17 pass | 1 note |
| 5 Drivers | 10 pass | |
| 6 Trips (create, dispatch, complete, cancel) | 38 pass | Includes concurrent dispatch |
| 7 Maintenance | 14 pass | |
| 8 Fuel, expenses, cost KPIs | 15 pass | |
| 9 Reports and exports | 8 pass | CSV escaping, three PDF exports |
| 10 Search and filtering | 4 pass | |
| 11 Database integrity | 7 pass | Indexes, foreign keys, money precision, empty-database start |
| 12 API errors and CORS | 7 pass | |
| 14 Demo accounts and seed consistency | 9 pass | |
| 15 Fresh account | covered by 1, 4–7 | |

## Bugs found and fixed in this round

| Bug | Impact | Fix |
|---|---|---|
| App could not start on an empty database | Hangfire created its tables first, so `EnsureCreated()` skipped the app tables. Any new deployment would crash. | Create the app tables explicitly when `Vehicles` is missing |
| No forwarded-header handling | Behind a hosting proxy the login cookie never got `Secure`, and all users shared one login rate-limit bucket | `UseForwardedHeaders`, with `ReverseProxy:TrustAllProxies` for platforms such as Render |
| Refresh always opened the dashboard | Refreshing any page lost your place | Remember the requested page while the session is checked |
| No confirmation for destructive actions | Retire vehicle, cancel trip, delete expense and suspend driver ran on one click | Confirmation dialogs |
| "Return to Available" on In Shop vehicles always failed | The button could never succeed while a work order was open | Replaced with guidance to close the work order |
| Receipt email HTML had no charset | Some mail clients could show `â‚¹` instead of `₹` | `<meta charset="utf-8">` |

## Subscription receipt, end to end

Purchase flow on the test API: plan → email code (from the mail catcher) → real Razorpay **test** order →
payment recorded → `retry-emails`. The customer received an HTML receipt with
`TransitOps-Receipt-TO-<date>-<id>.pdf` attached, plus the account-setup email. The Razorpay checkout
popup itself was not driven automatically (it runs in a cross-origin frame); try it once by hand with a
[Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-details/).

## Notes (not failures)

- **Logout and copied tokens:** logout deletes the cookie, but a copied JWT stays valid until it expires (30 minutes). Server-side revocation would need a token denylist or security-stamp check.
- **Refresh tokens:** not implemented; users sign in again after 30 minutes.
- **Pagination and sorting:** list endpoints return every tenant row. Fine for demo sizes.
- **Dashboard filters** run in the browser on loaded data; the KPI API has no filter parameters.

## Manual browser checks (section 13)

| Check | Result |
|---|---|
| Backend validation errors appear in forms | Pass (e.g. "Model must be 100 characters or fewer") |
| Empty states | Pass: every list has an empty message |
| Confirmation for destructive actions | Pass after fix |
| Role-based navigation | Pass: sidebar matches the permission matrix |
| Responsive layout | Pass: no horizontal overflow at 375 px on all 8 Fleet Manager screens |
| Refresh keeps the current page | Pass after fix |
| Keyboard accessibility | Partial: buttons are real buttons, but table rows that select a vehicle or driver are mouse-only |
