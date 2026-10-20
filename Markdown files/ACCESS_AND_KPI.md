# TransitOps Access Model and KPI Definitions

This document records the current API authorization and the dashboard formulas. UI visibility is only a convenience; the ASP.NET endpoints enforce the listed role restrictions and tenant filters.

## Role names and assignment

The application defines `OrganizationAdmin`, `FleetManager`, `Driver`, `SafetyOfficer`, and `FinancialAnalyst`. There is no separate `Dispatcher` role. Public registration is disabled. Organization Admins create tenant-scoped operational accounts but cannot create another Organization Admin.

The initial production Organization Admin provisioning flow after a software purchase is not connected to a billing provider. Local Development seeds a demo Organization Admin for exercising the dashboard; production onboarding must only provision this role through a trusted purchase fulfillment operation.

**Driver/Dispatcher distinction:** the application defines `Driver`, not a separate `Dispatcher` role. A Driver can view and complete trips assigned to the linked driver profile only. A Driver without a linked profile sees no trips. Creating, dispatching, and cancelling trips are Fleet Manager actions.

## Current permission matrix

`V` = view, `C` = create, `U` = update, `R` = retire (soft-delete), `X` = export, `Dsp` = dispatch, `Cmp` = complete, `Can` = cancel, `Adm` = administer. `—` means no corresponding endpoint is granted. A blank rule is not inferred as a product requirement.

| Resource / action | Organization Admin | Fleet Manager | Driver | Safety Officer | Financial Analyst | Notes |
|---|---:|---:|---:|---:|---:|---|
| Vehicles: view | — | V | V | V | V | Queries are tenant-scoped. Acquisition cost and revenue fields are redacted for Driver and Safety Officer. |
| Vehicles: create/update | — | C/U | — | — | — | Fleet Manager only. |
| Vehicles: delete/retire | — | R | — | — | — | `DELETE /vehicles/{id}` changes status to Retired; it does not physically delete history. |
| Drivers: view | — | V | — | V | — | Fleet Manager and Safety Officer can view profile/contact/license data. |
| Drivers: create | — | C | — | — | — | Fleet Manager only. |
| Drivers: update/suspend/remind | — | U | — | U | — | Fleet Manager and Safety Officer; current update endpoint permits profile edits to either role. |
| Drivers: record incident / view safety-score breakdown | — | C/V | — | C/V | — | `POST /drivers/{id}/incidents`, `GET /drivers/{id}/safety-score`. The score itself cannot be edited by hand. |
| Trips: view | — | V | Assigned trips only | — | V | Tenant-scoped. Financial values are not returned to Driver. |
| Trips: create/dispatch/cancel | — | C/Dsp/Can | — | — | — | Fleet Manager only. |
| Trips: complete | — | Cmp | Assigned dispatched trips only | — | — | Driver completion checks the linked driver profile on the API. |
| Maintenance: view | — | V | — | V | V | Financial Analyst read access supports cost analysis; writes remain Fleet Manager only. |
| Maintenance: create/close | — | C/U | — | — | — | Fleet Manager only. |
| Expenses: view/create/delete | — | V/C/D | — | — | V/C/D | Financial Analyst and Fleet Manager. |
| Fleet/driver/safety/financial KPIs | — | Fleet | Driver | Safety | Financial | Each KPI endpoint is role-protected and tenant-scoped. |
| Trip CSV export | — | X | — | — | X | Financial fields are provided only to Fleet Manager and Financial Analyst. |
| Financial ledger PDF export | — | — | — | — | X | Financial Analyst only. |
| Trip PDF turn-in receipt | — | X | Assigned trips only | — | — | Driver receipt access is checked against the linked driver profile. |
| Fleet vehicle ROI PDF | — | X | — | — | — | Fleet Manager only; uses completed-trip revenue and maintenance/fuel costs per vehicle. |
| Organization account list/create operational accounts | C | — | — | — | — | Organization Admin only; tenant-scoped. Driver account creation also creates a linked Driver profile. |
| Create or promote Organization Admin | — | — | — | — | — | Not available through the public API or Organization Admin dashboard; requires trusted purchase provisioning. |
| Hangfire dashboard | — | Fleet Manager | — | — | — | Restricted to authenticated Fleet Managers. |

The Safety Officer can update driver details and status, send license reminders, and view maintenance records; maintenance creation and closure remain Fleet Manager actions. Fleet Managers can modify driver records and vehicle operations. Driver trip ownership is checked by the API for trip reads, completion, and PDF receipts.

## Tenant and sensitive-data boundaries

- Every protected API requires an authenticated user with a `tenant_id` claim. Resource queries and writes include that tenant identifier.
- The frontend does not store bearer tokens in local storage. Authentication uses an HttpOnly JWT cookie.
- Fleet Manager and Financial Analyst are the only roles whose vehicle and trip responses include financial fields. The vehicle UI also hides financial detail and financial export columns from other roles.
- PostgreSQL credentials remain server-side. The RLS scripts intentionally enable RLS without creating permissive public policies; they are not a substitute for the API tenant filters.
- Vehicle registration numbers and driver email/license numbers are normalized before saving and have unique database indexes. The current uniqueness scope is global, not tenant-local.
- Retired vehicles remain in storage and historical records. Active trip or maintenance records prevent retirement.

## Fleet dashboard KPIs

The dashboard uses persisted API records. Vehicle type, status, and region filters apply to vehicle counts and to trips assigned to the filtered vehicles. The Drivers On Duty count remains fleet-wide because driver profiles are not associated with regions or vehicle types.

| KPI | Formula / definition |
|---|---|
| Active Vehicles | Count of vehicles whose status is `OnTrip` (`On Trip` in the UI). |
| Available Vehicles | Count of vehicles whose status is `Available`. |
| Vehicles in Maintenance | Count of vehicles whose status is `InShop` (`In Shop` in the UI). |
| Active Trips | Count of trips with status `Dispatched`, limited to trips whose assigned vehicle matches active dashboard filters. |
| Pending Trips | Count of trips with status `Draft`, limited to trips whose assigned vehicle matches active dashboard filters. |
| Drivers On Duty | Count of driver records with status `OnDuty` (`On Duty` in the UI). It is not filtered by vehicle type/status/region. |
| Fleet Utilization | `OnTrip vehicles / non-retired vehicles × 100`, rounded to one decimal place. The result is `0` when there are no non-retired vehicles. Vehicle filters define the numerator and denominator. |

Retired vehicles are excluded from the utilization denominator. Empty filtered sets produce zero counts and an explicit empty dispatch state. The active-dispatch panel displays saved trip routes and does not claim to show GPS positions; the model has no live location coordinates.

## Financial formulas

Financial KPI calculations are performed by the backend from tenant-persisted data. No diesel-price or fuel-consumption estimates are substituted for missing expense records.

| KPI | Formula / definition |
|---|---|
| Fuel Spend | Sum of recorded expenses where type is `Fuel`. |
| Maintenance Spend | Sum of recorded maintenance costs. |
| Other Expenses | Sum of recorded expenses whose type is not `Fuel`. |
| Total OPEX | Maintenance Spend + Fuel Spend + Other Expenses. |
| Gross Revenue | Sum of revenue from `Completed` trips only. |
| Net Profit | Gross Revenue − Total OPEX. |
| Net Margin (%) | `Net Profit / Gross Revenue × 100`, or zero when gross revenue is zero; rounded to one decimal place. |
| Cost per km | `Total OPEX / sum of planned distance for Completed trips`, or zero when completed planned distance is zero; rounded to two decimals. |

No reporting-period filter is currently defined; financial totals cover all persisted records in the tenant. The Driver KPI `OnTimeDepartureRate` is `null`: the model has no scheduled departure/due-time field, so an on-time formula is intentionally not invented.

## Remaining product decisions

- Whether Financial Analysts may view more than aggregate maintenance costs.
- Whether global uniqueness for vehicle registrations and driver email/license values is intended, or should be tenant-local.
- Whether dashboard financial totals need a reporting period, and what date basis to use.
- Whether vehicle utilization should exclude vehicles under maintenance in addition to retired vehicles.

## Driver safety score

The safety score (0–100) is calculated by `SafetyScoreCalculator` and cannot be typed in. It is recalculated when a driver is created or edited, when a trip is completed, when an incident is recorded, and daily by the `daily-safety-score-recalculation` Hangfire job (02:30 UTC, after the licence-expiry check).

| Factor | Points |
|---|---|
| Starting score | 100 |
| Recorded incidents | −8 each, at most −40 |
| Licence expired | −25 |
| Licence expires within 30 days | −5 |
| Fuel discipline | Completed trips in the last 90 days are inefficient when planned km ÷ fuel litres < 85% of the vehicle's rated km/L. Deduction = 15 × share of inefficient trips, applied once at least 3 trips have fuel data. This is a proxy for harsh acceleration and idling, since there is no telematics data. |
| Experience | +1 per 25 completed trips, at most +5; it can only recover deductions |

The result is clamped to 0–100. Bands: 90+ Excellent, 75–89 Good, 60–74 Needs attention, below 60 High risk. The Safety Officer dashboard shows the breakdown when the score is clicked. Incidents are stored as a count; there is no dated incident log yet, so incidents never expire from the score.

## Indian licence and registration validation

Rules live in `IndianRegulatoryFormats` (backend) and `frontend/src/utils/indianFormats.ts` (form feedback). The API is authoritative.

- **Vehicle registration** (CMVR 1989 rule 50): `SS-RR-XXX-NNNN`, where SS is a valid state/UT code, RR is a 1–2 digit RTO code (not 00), XXX is an optional 1–3 letter series and NNNN is 0001–9999. Delhi marks with a category letter (`DL-1C-AB-1234`) are supported, as is the Bharat series (`22-BH-1234-AA`, year 21 onwards, no I/O in the series). Numbers are stored in canonical hyphenated form, and duplicates are detected regardless of spacing or hyphens.
- **Driving licence** (Sarathi format): 15 characters, `SS RR YYYY NNNNNNN`: state code, RTO code, issue year (1950 to the current year) and 7-digit serial. Stored without separators. Older paper licences in other formats must be converted to the Sarathi format first.
- **Licence class**: one or more of MCWG, MCWOG, LMV, LMV-NT, LMV-TR, MGV, HMV, HGMV, HPMV, HTV, TRANS (Motor Vehicles Act 1988, section 10).
- **Licence expiry**: no more than 20 years ahead, and not before the issue year in the licence number.

## Vehicle ROI

The vehicle ROI matrix uses completed-trip revenue and subtracts each vehicle's maintenance and fuel expenses to calculate operating profit. ROI is `operating profit / acquisition cost × 100`; acquisition cost is the invested-capital denominator, not an operating expense. The Fleet Manager PDF uses the same per-vehicle calculation. Demo historical trip revenue uses ₹38 per tonne-kilometre (`distance km × cargo kg / 1,000 × ₹38`); seed runs recompute these demo trip amounts so an existing development database receives the corrected values.

Development sample records are owned by the `demo_tenant` and are visible to all accounts in that organization, including operational accounts created by its demo Organization Admin. Data isolation is tenant-based, not based on email addresses or role. A fresh production organization must be provisioned with a distinct tenant; the purchase-based provisioning integration is not yet implemented.
- Whether driver-on-duty counts should be scoped by region/type after driver-to-fleet assignment is modeled.
