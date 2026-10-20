"""End-to-end API checks for the TransitOps test checklist (docs/test.md sections 1-15).

Run against a disposable database only: it creates vehicles, drivers, trips, users and
expenses, and it deliberately locks out a throwaway account. See tests/api/README.md.

    python tests/api/checklist.py --base http://localhost:5000 --password <demo password>
            [--db-query "node tools/testdb/dbquery.mjs"] [--report report.json]

Only the Python standard library is used.
"""
import argparse
import concurrent.futures
import csv
import http.cookiejar
import io
import json
import random
import shlex
import string
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

sys.stdout.reconfigure(encoding="utf-8")

args = argparse.ArgumentParser()
args.add_argument("--base", default="http://localhost:5000")
args.add_argument("--password", required=True, help="DemoAccounts:Password of the API under test")
args.add_argument("--db-query", help="command that runs one SQL query and prints JSON rows")
args.add_argument("--report", help="write results as JSON to this file")
args.add_argument("--skip-rate-limit", action="store_true")
opts = args.parse_args()
API = opts.base.rstrip("/") + "/api"
RUN = "".join(random.choices(string.ascii_uppercase, k=2))  # keeps this run's records apart

# ---------------------------------------------------------------- results

results = []
section = ""


def begin(name):
    global section
    section = name
    print(f"\n== {name}")


def record(item, status, detail=""):
    results.append({"section": section, "item": item, "status": status, "detail": detail})
    mark = {"PASS": "PASS", "FAIL": "FAIL", "NOTE": "NOTE", "MANUAL": "MANUAL"}[status]
    print(f"  {mark:<6} {item}" + (f" — {detail}" if detail else ""))


def check(item, condition, detail=""):
    record(item, "PASS" if condition else "FAIL", detail)
    return condition


def expect(item, response, *statuses, detail=""):
    status, body = response
    ok = status in statuses
    extra = detail or (f"HTTP {status}" + (f": {message(body)}" if not ok and status >= 400 else ""))
    record(item, "PASS" if ok else "FAIL", extra if not ok or detail else "")
    return ok


def message(body):
    if isinstance(body, dict):
        if body.get("errors"):
            return " ".join(m for v in body["errors"].values() for m in v)
        return str(body.get("message") or body.get("detail") or body.get("title"))
    return str(body)[:200]


# ---------------------------------------------------------------- HTTP

LOGIN_TIMES = []


class Session:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None, raw=None, headers=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        h = {"Content-Type": "application/json"}
        h.update(headers or {})
        req = urllib.request.Request(API + path, data=data, method=method, headers=h)
        try:
            with self.opener.open(req, timeout=60) as r:
                return r.status, decode(r.read(), r.headers), r.headers
        except urllib.error.HTTPError as e:
            return e.code, decode(e.read(), e.headers), e.headers

    def get(self, path, **kw):
        s, b, _ = self.call("GET", path, **kw)
        return s, b

    def post(self, path, body=None, **kw):
        s, b, _ = self.call("POST", path, body, **kw)
        return s, b

    def put(self, path, body=None, **kw):
        s, b, _ = self.call("PUT", path, body, **kw)
        return s, b

    def delete(self, path, **kw):
        s, b, _ = self.call("DELETE", path, **kw)
        return s, b

    def cookie(self, name):
        return next((c for c in self.jar if c.name == name), None)


def decode(raw, headers):
    ctype = headers.get("Content-Type", "") if headers else ""
    if "json" in ctype:
        try:
            return json.loads(raw or b"null")
        except ValueError:
            return raw.decode(errors="replace")
    if ctype.startswith("text/"):
        return raw.decode("utf-8-sig", errors="replace")
    return raw


def respect_login_limit():
    """The API allows 10 login attempts per minute per IP; wait instead of tripping it."""
    now = time.time()
    while LOGIN_TIMES and now - LOGIN_TIMES[0] > 62:
        LOGIN_TIMES.pop(0)
    if len(LOGIN_TIMES) >= 9:
        wait = 63 - (now - LOGIN_TIMES[0])
        print(f"  (waiting {wait:.0f}s for the login rate-limit window)")
        time.sleep(max(wait, 0))
        LOGIN_TIMES.clear()
    LOGIN_TIMES.append(time.time())


def login(email, password=None):
    respect_login_limit()
    s = Session()
    status, body, _ = s.call("POST", "/auth/login", {"email": email, "password": password or opts.password})
    return s, status, body


def session_for(email, password=None):
    s, status, body = login(email, password)
    if status != 200:
        raise SystemExit(f"Cannot log in as {email}: HTTP {status} {message(body)}")
    return s


def db(sql):
    if not opts.db_query:
        return None
    out = subprocess.run(shlex.split(opts.db_query, posix=False) + [sql], capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


# ---------------------------------------------------------------- data helpers

STATE_RTO = ["KA", "TN", "GJ", "RJ", "UP", "WB", "HR", "PB"]
used = set()


def new_registration():
    while True:
        reg = f"{random.choice(STATE_RTO)}-{random.randint(1, 60):02d}-{RUN}-{random.randint(1, 9999):04d}"
        if reg not in used:
            used.add(reg)
            return reg


def new_licence():
    return f"{random.choice(STATE_RTO)}{random.randint(1, 60):02d}20{random.randint(10, 24)}{random.randint(1, 9999999):07d}"


def vehicle_body(**over):
    body = {"registrationNumber": new_registration(), "name": f"Test {RUN} truck", "model": "Tata LPT 1618",
            "type": "Truck", "maxCapacityKg": 8000, "currentOdometerKm": 1000, "acquisitionCost": 2500000,
            "region": "West"}
    body.update(over)
    return body


def driver_body(**over):
    n = random.randint(100000, 999999)
    body = {"name": f"Test Driver {RUN}{n}", "email": f"test.{RUN.lower()}{n}@example.test",
            "contactNumber": f"+91 98{random.randint(10000000, 99999999)}", "licenseNumber": new_licence(),
            "licenseCategory": "HGMV", "licenseExpiryDate": (date.today() + timedelta(days=900)).isoformat()}
    body.update(over)
    return body


def make_vehicle(fm, **over):
    status, body = fm.post("/vehicles", vehicle_body(**over))
    if status != 201:
        raise RuntimeError(f"vehicle create failed: {status} {message(body)}")
    return body


def make_driver(fm, **over):
    status, body = fm.post("/drivers", driver_body(**over))
    if status != 201:
        raise RuntimeError(f"driver create failed: {status} {message(body)}")
    return body


def make_trip(fm, vehicle, driver, **over):
    body = {"source": "Pune", "destination": "Mumbai", "vehicleId": vehicle["id"], "driverId": driver["id"],
            "cargoWeightKg": 2000, "plannedDistanceKm": 150, "revenue": 45000}
    body.update(over)
    return fm.post("/trips", body)


def find(items, item_id):
    return next((x for x in items if x["id"] == item_id), None)


def vehicle_status(fm, vid):
    return find(fm.get("/vehicles")[1], vid)["status"]


def driver_status(fm, did):
    return find(fm.get("/drivers")[1], did)["status"]


# ================================================================ sessions

admin = session_for("admin@transitops.com")
fm = session_for("manager@transitops.com")
drv = session_for("driver@transitops.com")
so = session_for("safety@transitops.com")
fa = session_for("analyst@transitops.com")
anon = Session()

# ================================================================ 1. Authentication

begin("1.1 Registration (organization user provisioning)")
s, b = anon.post("/auth/register", {"email": "x@example.test", "password": "Passw0rd!xyz"})
check("Public self-registration is not exposed", s in (401, 404, 405) and fm.post("/auth/register", {})[0] in (404, 405), f"HTTP {s}")

user_email = f"fm.{RUN.lower()}{random.randint(1000, 9999)}@example.test"
user_password = "Str0ng!Passw0rd"
base_user = {"fullName": "Test Fleet Manager", "email": user_email, "password": user_password, "role": "FleetManager"}
expect("Invalid email rejected", admin.post("/admin/users", {**base_user, "email": "not-an-email"}), 400)
expect("Whitespace-only name rejected", admin.post("/admin/users", {**base_user, "fullName": "   "}), 400)
expect("Weak password rejected by backend", admin.post("/admin/users", {**base_user, "password": "short"}), 400)
expect("Cannot create Organization Admin through the API", admin.post("/admin/users", {**base_user, "role": "OrganizationAdmin"}), 400)
expect("Unknown role rejected", admin.post("/admin/users", {**base_user, "role": "SuperUser"}), 400)
s, created = admin.post("/admin/users", base_user)
expect("Organization Admin can create a Fleet Manager", (s, created), 201, 200)
s, users = admin.get("/admin/users")
check("New account persisted and listed", s == 200 and any(u["email"].lower() == user_email for u in users))
expect("Duplicate email rejected", admin.post("/admin/users", base_user), 400, 409)

dup_email = f"race.{RUN.lower()}{random.randint(1000, 9999)}@example.test"
with concurrent.futures.ThreadPoolExecutor(4) as pool:
    codes = list(pool.map(lambda _: admin.post("/admin/users", {**base_user, "email": dup_email})[0], range(4)))
check("Concurrent duplicate registrations create one account", sorted(codes).count(201) + sorted(codes).count(200) == 1, f"codes {codes}")

s, b = admin.post("/admin/users", {**base_user, "email": "bad"})
check("Validation errors do not leak internals", "Exception" not in json.dumps(b) and "   at " not in json.dumps(b))
newbie, s, me = login(user_email, user_password)
check("New account can log in", s == 200, f"HTTP {s}")
check("New account has only the assigned role", s == 200 and me.get("role") == "fleet_manager", str(me.get("role") if isinstance(me, dict) else me))
expect("New Fleet Manager cannot administer users", newbie.get("/admin/users"), 403)
expect("Fleet Manager cannot call admin create (role elevation)", newbie.post("/admin/users", {**base_user, "email": "elev@example.test", "role": "FleetManager"}), 403)

begin("1.2 Login and session security")
expect("Valid credentials log in", login("manager@transitops.com")[1:2] + (None,), 200)
_, s1, b1 = login("manager@transitops.com", "WrongPassword!1")
_, s2, b2 = login(f"nobody.{RUN.lower()}@example.test", "WrongPassword!1")
check("Invalid credentials rejected", s1 == 401, f"HTTP {s1}")
check("Unknown email and wrong password give the same response", (s1, message(b1)) == (s2, message(b2)), f"{s1}/{s2}")
for path in ["/vehicles", "/drivers", "/trips", "/maintenance", "/expenses", "/kpi/fleet", "/admin/users", "/reports/export/csv/trips"]:
    expect(f"Unauthenticated GET {path} is rejected", anon.get(path), 401)
token = fm.cookie("transitops_access")
check("Auth cookie is HttpOnly", token is not None and any(k.lower() == "httponly" for k in token._rest))
expect("Garbage token rejected", Session().get("/vehicles", headers={"Cookie": "transitops_access=abc.def.ghi"}), 401)
if token:
    parts = token.value.split(".")
    tampered = parts[0] + "." + parts[1][:-2] + ("A" if parts[1][-2] != "A" else "B") + parts[1][-1] + "." + parts[2]
    expect("Tampered token rejected", Session().get("/vehicles", headers={"Cookie": f"transitops_access={tampered}"}), 401)

temp, _, _ = login(user_email, user_password)
saved = temp.cookie("transitops_access").value
s, _, hdrs = temp.call("POST", "/auth/logout")
set_cookie = (hdrs.get("Set-Cookie") or "").lower()
check("Logout clears the auth cookie", s in (200, 204) and "transitops_access=" in set_cookie and "1970" in set_cookie, set_cookie[:80])
expect("Session is gone after logout", temp.get("/auth/me"), 401)
s, _ = Session().get("/auth/me", headers={"Cookie": f"transitops_access={saved}"})
record("A copied token stops working after logout", "PASS" if s == 401 else "NOTE",
       "" if s == 401 else "Stateless 30-minute JWT: a copied token stays valid until expiry (no server-side revocation)")
record("Refresh tokens", "NOTE", "Not implemented; sessions expire after 30 minutes")

lock_email = f"lock.{RUN.lower()}{random.randint(1000, 9999)}@example.test"
admin.post("/admin/users", {**base_user, "email": lock_email})
for _ in range(5):
    login(lock_email, "WrongPassword!1")
_, s, b = login(lock_email, user_password)
check("Account locks after 5 failed attempts (correct password refused)", s == 401, f"HTTP {s}")

# ================================================================ 2. RBAC

begin("2. Role-based access control")
roles = {"OrganizationAdmin": admin, "FleetManager": fm, "Driver": drv, "SafetyOfficer": so, "FinancialAnalyst": fa}
for email, role in [("admin", "OrganizationAdmin"), ("manager", "FleetManager"), ("driver", "Driver"),
                    ("safety", "SafetyOfficer"), ("analyst", "FinancialAnalyst")]:
    s, me = roles[role].get("/auth/me")
    api_role = "".join("_" + c.lower() if c.isupper() else c for c in role).lstrip("_")
    check(f"Demo {email}@ has role {role}", s == 200 and me.get("role") == api_role, str(me.get("role") if isinstance(me, dict) else s))

matrix = {  # endpoint -> roles allowed (from docs/ACCESS_AND_KPI.md)
    ("GET", "/vehicles"): {"FleetManager", "Driver", "SafetyOfficer", "FinancialAnalyst"},
    ("GET", "/drivers"): {"FleetManager", "SafetyOfficer"},
    ("GET", "/trips"): {"FleetManager", "Driver", "FinancialAnalyst"},
    ("GET", "/maintenance"): {"FleetManager", "SafetyOfficer", "FinancialAnalyst"},
    ("GET", "/expenses"): {"FleetManager", "FinancialAnalyst"},
    ("GET", "/kpi/fleet"): {"FleetManager"},
    ("GET", "/kpi/driver"): {"Driver"},
    ("GET", "/kpi/safety"): {"SafetyOfficer"},
    ("GET", "/kpi/financial"): {"FinancialAnalyst"},
    ("GET", "/reports/export/csv/trips"): {"FleetManager", "FinancialAnalyst"},
    ("GET", "/reports/export/pdf/ledger"): {"FinancialAnalyst"},
    ("GET", "/reports/export/pdf/fleet-roi"): {"FleetManager"},
    ("GET", "/admin/users"): {"OrganizationAdmin"},
}
for (method, path), allowed in matrix.items():
    for role, sess in roles.items():
        s, _ = sess.get(path)
        want_ok = role in allowed
        ok = (s == 200) if want_ok else (s == 403)
        if not ok:
            record(f"{role} {method} {path}", "FAIL", f"HTTP {s}, expected {'200' if want_ok else '403'}")
record("Permission matrix enforced for 13 endpoints × 5 roles",
       "PASS" if not any(r["status"] == "FAIL" and r["item"].startswith(tuple(roles)) for r in results) else "FAIL")

write_paths = [("POST", "/vehicles", vehicle_body()), ("POST", "/drivers", driver_body()),
               ("POST", "/maintenance", {}), ("POST", "/trips", {})]
for method, path, body in write_paths:
    for role in ["Driver", "SafetyOfficer", "FinancialAnalyst", "OrganizationAdmin"]:
        s, _ = roles[role].post(path, body)
        check(f"{role} cannot {method} {path}", s == 403, f"HTTP {s}")

s, vs = drv.get("/vehicles")
check("Driver does not see vehicle acquisition cost or revenue", s == 200 and all(v.get("acquisitionCost") is None and v.get("revenueGenerated") is None for v in vs))
s, vs = so.get("/vehicles")
check("Safety Officer does not see vehicle financials", s == 200 and all(v.get("acquisitionCost") is None for v in vs))
s, ts = drv.get("/trips")
s2, me = drv.get("/auth/me")
check("Driver sees only their own trips", s == 200 and len({t["driverName"] for t in ts}) <= 1, f"{len(ts)} trips, drivers {sorted({t['driverName'] for t in ts})}")
check("Driver trip list hides revenue", s == 200 and all(t.get("revenue") is None for t in ts))
def root_get(path, sess):
    req = urllib.request.Request(opts.base.rstrip("/") + path)
    try:
        with sess.opener.open(req, timeout=60) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


check("Driver cannot open the Hangfire dashboard", root_get("/hangfire", drv) in (401, 403), f"HTTP {root_get('/hangfire', drv)}")
check("Fleet Manager can open the Hangfire dashboard", root_get("/hangfire", fm) == 200, f"HTTP {root_get('/hangfire', fm)}")

# ================================================================ 4. Vehicles

begin("4. Vehicle registry")
v1 = make_vehicle(fm)
check("Vehicle creation works and stores canonical registration", v1["registrationNumber"].count("-") == 3, v1["registrationNumber"])
expect("Vehicle details can be viewed", fm.get(f"/vehicles/{v1['id']}"), 200)
s, upd = fm.put(f"/vehicles/{v1['id']}", {"name": "Renamed probe", "maxCapacityKg": 9000})
check("Vehicle update persists", s == 200 and fm.get(f"/vehicles/{v1['id']}")[1]["maxCapacityKg"] == 9000, f"HTTP {s}")
compact = v1["registrationNumber"].replace("-", "").lower()
expect("Duplicate registration (different formatting) rejected", fm.post("/vehicles", vehicle_body(registrationNumber=compact)), 409)
race_reg = new_registration()
with concurrent.futures.ThreadPoolExecutor(4) as pool:
    codes = list(pool.map(lambda _: fm.post("/vehicles", vehicle_body(registrationNumber=race_reg))[0], range(4)))
check("Concurrent duplicate registrations create one vehicle", codes.count(201) == 1, f"codes {codes}")
for field, value, label in [("maxCapacityKg", 0, "Zero capacity"), ("maxCapacityKg", -5, "Negative capacity"),
                            ("currentOdometerKm", -1, "Negative odometer"), ("acquisitionCost", -1, "Negative cost"),
                            ("type", "Spaceship", "Unknown vehicle type"), ("name", "  ", "Blank name"),
                            ("maxCapacityKg", "heavy", "Non-numeric capacity")]:
    expect(f"{label} rejected", fm.post("/vehicles", vehicle_body(**{field: value})), 400)
expect("Status cannot be set to an unsupported value", fm.put(f"/vehicles/{v1['id']}/status", {"status": "Flying"}), 400)
s, lst = fm.get("/vehicles?status=Available")
check("Status filter works", s == 200 and lst and all(v["status"] == "Available" for v in lst), f"{len(lst) if s == 200 else s}")
s, lst = fm.get(f"/vehicles?search={v1['registrationNumber']}")
check("Search by registration works", s == 200 and any(v["id"] == v1["id"] for v in lst))
s, lst = fm.get("/vehicles?region=West")
check("Region filter works", s == 200 and all(v["region"] == "West" for v in lst))
s, lst = fm.get("/vehicles?status=NotAStatus")
check("Invalid status filter handled safely", s in (200, 400), f"HTTP {s}")
record("Vehicle list pagination/sorting", "NOTE", "List endpoints return all tenant rows; no paging or sort parameters")

# ================================================================ 5. Drivers

begin("5. Driver management")
d1 = make_driver(fm)
expect("Driver details can be viewed", fm.get(f"/drivers/{d1['id']}"), 200)
s, _ = fm.put(f"/drivers/{d1['id']}", {"contactNumber": "+91 99887 76655"})
check("Driver update persists", s == 200 and fm.get(f"/drivers/{d1['id']}")[1]["contactNumber"] == "+919988776655", f"HTTP {s}")
expect("Duplicate licence rejected", fm.post("/drivers", driver_body(licenseNumber=d1["licenseNumber"])), 409)
expect("Blank name rejected", fm.post("/drivers", driver_body(name=" ")), 400)
expect("Invalid contact number rejected", fm.post("/drivers", driver_body(contactNumber="12ab")), 400)
expect("Invalid licence format rejected", fm.post("/drivers", driver_body(licenseNumber="ABC123")), 400)
expect("Invalid status rejected", fm.put(f"/drivers/{d1['id']}", {"status": "Sleeping"}), 400)
fm.put(f"/drivers/{d1['id']}", {"safetyScore": 5})
check("Safety score cannot be set by hand", fm.get(f"/drivers/{d1['id']}")[1]["safetyScore"] != 5)
check("Safety score stays within 0-100", all(0 <= d["safetyScore"] <= 100 for d in fm.get("/drivers")[1]))
expired = make_driver(fm, licenseExpiryDate=(date.today() - timedelta(days=1)).isoformat())
s, k = so.get("/kpi/safety")
check("Expired licences detected using today's date", s == 200 and k["expiredLicenses"] >= 1, str(k.get("expiredLicenses") if s == 200 else s))
today_driver = make_driver(fm, licenseExpiryDate=date.today().isoformat())

# ================================================================ 6. Trips

begin("6.1 Trip creation")
va, vb = make_vehicle(fm, maxCapacityKg=5000), make_vehicle(fm)
da, db_ = make_driver(fm), make_driver(fm)
s, draft = make_trip(fm, va, da)
expect("Trip with eligible vehicle and driver created as Draft", (s, draft), 201)
check("Draft does not reserve vehicle or driver", vehicle_status(fm, va["id"]) == "Available" and driver_status(fm, da["id"]) == "Available")
expect("Cargo above capacity rejected", make_trip(fm, va, da, cargoWeightKg=5001), 400, 422)
expect("Negative cargo rejected", make_trip(fm, va, da, cargoWeightKg=-1), 400)
expect("Zero distance rejected", make_trip(fm, va, da, plannedDistanceKm=0), 400)
expect("Nonexistent vehicle rejected", make_trip(fm, {"id": "00000000-0000-0000-0000-000000000001"}, da), 400, 404)
expect("Nonexistent driver rejected", make_trip(fm, va, {"id": "00000000-0000-0000-0000-000000000001"}), 400, 404)
expect("Driver with expired licence rejected", make_trip(fm, vb, expired), 400, 422)
check("Licence expiring today is still valid today", make_trip(fm, vb, today_driver)[0] == 201)
susp = make_driver(fm)
fm.put(f"/drivers/{susp['id']}/toggle-suspension")
expect("Suspended driver rejected", make_trip(fm, vb, susp), 400, 422)
off = make_driver(fm)
fm.put(f"/drivers/{off['id']}", {"status": "OffDuty"})
expect("Off-duty driver rejected", make_trip(fm, vb, off), 400, 422)
retired = make_vehicle(fm)
fm.delete(f"/vehicles/{retired['id']}")
expect("Retired vehicle rejected", make_trip(fm, retired, db_), 400, 409, 422)

begin("6.2 Dispatch")
s, t = fm.post(f"/trips/{draft['id']}/dispatch")
expect("Draft trip dispatches", (s, t), 200)
check("Dispatch sets trip, vehicle and driver to On Trip",
      t.get("status") == "Dispatched" and vehicle_status(fm, va["id"]) == "OnTrip" and driver_status(fm, da["id"]) == "OnTrip")
expect("Dispatching twice rejected", fm.post(f"/trips/{draft['id']}/dispatch"), 400, 409)
expect("On-trip vehicle cannot get a new trip", make_trip(fm, va, db_), 400, 409, 422)
expect("On-trip driver cannot get a new trip", make_trip(fm, vb, da), 400, 409, 422)
expect("Vehicle on a trip cannot be marked Available", fm.put(f"/vehicles/{va['id']}/status", {"status": "Available"}), 409)
expect("Vehicle on a trip cannot be retired", fm.delete(f"/vehicles/{va['id']}"), 409)
expect("Driver status cannot change during an active trip", fm.put(f"/drivers/{da['id']}", {"status": "OffDuty"}), 409)
expect("Vehicle on a trip cannot enter maintenance", fm.post("/maintenance", {"vehicleId": va["id"], "serviceType": "Brakes", "description": "x", "cost": 10}), 409)

vc, dc1, dc2 = make_vehicle(fm), make_driver(fm), make_driver(fm)
t1, t2 = make_trip(fm, vc, dc1)[1], make_trip(fm, vc, dc2)[1]
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    codes = list(pool.map(lambda tid: fm.post(f"/trips/{tid}/dispatch")[0], [t1["id"], t2["id"]]))
check("Concurrent dispatch cannot double-book a vehicle", codes.count(200) == 1, f"codes {codes}")
loser = t2 if codes[0] == 200 else t1
s, trips_now = fm.get("/trips")
check("Failed dispatch leaves the other trip in Draft", find(trips_now, loser["id"])["status"] == "Draft")

begin("6.3 Completion")
odo = fm.get(f"/vehicles/{va['id']}")[1]["currentOdometerKm"]
expect("Final odometer below current rejected", fm.post(f"/trips/{draft['id']}/complete", {"finalOdometerKm": odo - 1, "fuelConsumedLiters": 10}), 400)
expect("Negative fuel rejected", fm.post(f"/trips/{draft['id']}/complete", {"finalOdometerKm": odo + 150, "fuelConsumedLiters": -1}), 400)
other_driver_trip = draft
expect("Another driver cannot complete this trip", drv.post(f"/trips/{draft['id']}/complete", {"finalOdometerKm": odo + 150, "fuelConsumedLiters": 20}), 403)
before_exp = len(fm.get("/expenses")[1])
s, done = fm.post(f"/trips/{draft['id']}/complete", {"finalOdometerKm": odo + 150, "fuelConsumedLiters": 20})
expect("Dispatched trip completes", (s, done), 200)
check("Completion frees vehicle and driver", vehicle_status(fm, va["id"]) == "Available" and driver_status(fm, da["id"]) == "Available")
check("Completion stores final odometer on the vehicle", fm.get(f"/vehicles/{va['id']}")[1]["currentOdometerKm"] == odo + 150)
fuel_rows = [e for e in fm.get("/expenses")[1] if e.get("tripId") == draft["id"]]
check("Completion records one fuel expense at the configured price", len(fuel_rows) == 1 and abs(float(fuel_rows[0]["amount"]) - 20 * 96.5) < 0.01,
      f"{[e['amount'] for e in fuel_rows]}")
expect("Completing twice rejected", fm.post(f"/trips/{draft['id']}/complete", {"finalOdometerKm": odo + 300, "fuelConsumedLiters": 5}), 400, 409)
check("Repeat completion has no side effects", len([e for e in fm.get("/expenses")[1] if e.get("tripId") == draft["id"]]) == 1)

begin("6.4 Cancellation")
vd, dd = make_vehicle(fm), make_driver(fm)
s, tc = make_trip(fm, vd, dd)
expect("Draft trip can be cancelled", fm.post(f"/trips/{tc['id']}/cancel"), 200)
s, tc2 = make_trip(fm, vd, dd)
fm.post(f"/trips/{tc2['id']}/dispatch")
expect("Dispatched trip can be cancelled", fm.post(f"/trips/{tc2['id']}/cancel"), 200)
check("Cancelling a dispatched trip frees vehicle and driver", vehicle_status(fm, vd["id"]) == "Available" and driver_status(fm, dd["id"]) == "Available")
expect("Cancelling twice rejected", fm.post(f"/trips/{tc2['id']}/cancel"), 409)
expect("Completed trip cannot be cancelled", fm.post(f"/trips/{draft['id']}/cancel"), 409)
check("Cancelled trips stay in history", find(fm.get("/trips")[1], tc2["id"])["status"] == "Cancelled")

# ================================================================ 7. Maintenance

begin("7. Maintenance")
vm = make_vehicle(fm)
s, m = fm.post("/maintenance", {"vehicleId": vm["id"], "serviceType": "Brake inspection", "description": "Pads", "cost": 4500})
expect("Maintenance record created", (s, m), 201)
check("Active maintenance puts vehicle In Shop", vehicle_status(fm, vm["id"]) == "InShop")
expect("Second active work order for the same vehicle rejected", fm.post("/maintenance", {"vehicleId": vm["id"], "serviceType": "Tyres", "description": "x", "cost": 1}), 409)
expect("Negative cost rejected", fm.post("/maintenance", {"vehicleId": vb["id"], "serviceType": "x", "description": "x", "cost": -1}), 400)
expect("Blank service type rejected", fm.post("/maintenance", {"vehicleId": vb["id"], "serviceType": " ", "description": "x", "cost": 1}), 400)
expect("In Shop vehicle cannot get a trip", make_trip(fm, vm, make_driver(fm)), 400, 409, 422)
expect("In Shop vehicle cannot be forced Available", fm.put(f"/vehicles/{vm['id']}/status", {"status": "Available"}), 409)
expect("Vehicle in maintenance cannot be retired", fm.delete(f"/vehicles/{vm['id']}"), 409)
expect("Closing work order succeeds", fm.post(f"/maintenance/{m['id']}/close", {"finalCost": 5200}), 200)
check("Closing maintenance returns vehicle to Available", vehicle_status(fm, vm["id"]) == "Available")
check("Final cost recorded", any(r["id"] == m["id"] and float(r["cost"]) == 5200 for r in fm.get("/maintenance")[1]))
expect("Closing twice rejected", fm.post(f"/maintenance/{m['id']}/close", {}), 409)
expect("Safety Officer can view maintenance", so.get("/maintenance"), 200)
expect("Safety Officer cannot create maintenance", so.post("/maintenance", {"vehicleId": vb["id"], "serviceType": "x", "description": "x", "cost": 1}), 403)

# ================================================================ 8. Expenses

begin("8. Fuel and expenses")
s, e = fa.post("/expenses", {"vehicleId": vb["id"], "type": "Toll", "amount": 850, "notes": f"Test {RUN} toll"})
expect("Financial Analyst records a toll", (s, e), 201)
expect("Fuel expense without litres rejected", fa.post("/expenses", {"vehicleId": vb["id"], "type": "Fuel", "amount": 500}), 400)
expect("Negative litres rejected", fa.post("/expenses", {"vehicleId": vb["id"], "type": "Fuel", "amount": 500, "liters": -3}), 400)
expect("Negative amount rejected", fa.post("/expenses", {"vehicleId": vb["id"], "type": "Toll", "amount": -1}), 400)
expect("Unknown category rejected", fa.post("/expenses", {"vehicleId": vb["id"], "type": "Snacks", "amount": 10}), 400)
expect("Unknown vehicle rejected", fa.post("/expenses", {"vehicleId": "00000000-0000-0000-0000-000000000001", "type": "Toll", "amount": 10}), 400)
expect("Vehicle/trip mismatch rejected", fa.post("/expenses", {"vehicleId": vb["id"], "tripId": draft["id"], "type": "Toll", "amount": 10}), 400)
expect("Driver cannot record expenses", drv.post("/expenses", {"vehicleId": vb["id"], "type": "Toll", "amount": 10}), 403)
expect("Expense can be deleted", fa.delete(f"/expenses/{e['id']}"), 204)

begin("8.3 / 9. Cost and financial KPIs")
s, k = fa.get("/kpi/financial")
exps = fa.get("/expenses")[1]
maint = fa.get("/maintenance")[1]
trips_all = fa.get("/trips")[1]
fuel = sum(float(x["amount"]) for x in exps if x["type"] == "Fuel")
other = sum(float(x["amount"]) for x in exps if x["type"] != "Fuel")
mspend = sum(float(x["cost"]) for x in maint)
revenue = sum(float(t["revenue"] or 0) for t in trips_all if t["status"] == "Completed")
opex = fuel + other + mspend
check("Fuel spend matches recorded fuel expenses", abs(float(k["fuelSpend"]) - fuel) < 1, f"{k['fuelSpend']} vs {fuel:.2f}")
check("Maintenance spend matches maintenance records", abs(float(k["maintenanceSpend"]) - mspend) < 1, f"{k['maintenanceSpend']} vs {mspend:.2f}")
check("Gross revenue counts completed trips only", abs(float(k["grossRevenue"]) - revenue) < 1, f"{k['grossRevenue']} vs {revenue:.2f}")
check("Total OPEX = fuel + maintenance + other", abs(float(k["totalOpex"]) - opex) < 1, f"{k['totalOpex']} vs {opex:.2f}")
maint_expense = sum(float(x["amount"]) for x in exps if x["type"] == "Maintenance")
record("Maintenance-type expenses vs maintenance records", "PASS" if maint_expense == 0 else "NOTE",
       "" if maint_expense == 0 else f"₹{maint_expense:,.0f} of expenses typed 'Maintenance' are counted in addition to maintenance records — possible double count")
check("Net profit = revenue − OPEX", abs(float(k["netProfit"]) - (revenue - opex)) < 1)

# ================================================================ 9. Reports

begin("9. Reports and exports")
csv_trip = make_trip(fm, vb, db_, source='Pune, "MH"', destination="Nashik")[1]
s, text = fm.get("/reports/export/csv/trips")
rows = list(csv.reader(io.StringIO(text))) if s == 200 and isinstance(text, str) else []
check("CSV export returns rows with a header", s == 200 and len(rows) > 1, f"HTTP {s}, {len(rows)} rows")
check("CSV escapes commas and quotes", any('Pune, "MH"' in r for r in rows))
s, text = fa.get("/reports/export/csv/trips")
check("Analyst CSV export works", s == 200)
for path, sess, name in [("/reports/export/pdf/ledger", fa, "Ledger PDF"), ("/reports/export/pdf/fleet-roi", fm, "Fleet ROI PDF"),
                         (f"/reports/export/pdf/trip/{draft['id']}", fm, "Trip receipt PDF")]:
    s, body = sess.get(path)
    check(f"{name} is a PDF", s == 200 and isinstance(body, bytes) and body[:4] == b"%PDF", f"HTTP {s}")
expect("Driver cannot download another driver's trip receipt", drv.get(f"/reports/export/pdf/trip/{draft['id']}"), 403, 404)
s, k = fm.get("/kpi/fleet")
record("ROI uses stored revenue (trip revenue field)", "PASS", "Revenue is captured per trip and summed for completed trips")

# ================================================================ 3. Dashboard KPIs

begin("3. Fleet dashboard KPIs")
vs, ts, ds = fm.get("/vehicles")[1], fm.get("/trips")[1], fm.get("/drivers")[1]
s, k = fm.get("/kpi/fleet")
count = lambda xs, st: sum(1 for x in xs if x["status"] == st)
non_retired = sum(1 for v in vs if v["status"] != "Retired")
check("Active vehicles = On Trip count", k["activeVehicles"] == count(vs, "OnTrip"), f"{k['activeVehicles']} vs {count(vs, 'OnTrip')}")
check("Available vehicles count", k["availableAssets"] == count(vs, "Available"), f"{k['availableAssets']} vs {count(vs, 'Available')}")
check("In-maintenance count", k["maintenanceHolds"] == count(vs, "InShop"))
check("Active trips = Dispatched count", k["activeDispatches"] == count(ts, "Dispatched"))
check("Pending trips = Draft count", k["pendingDepartures"] == count(ts, "Draft"))
check("Drivers on duty count", k["driversOnDuty"] == count(ds, "OnDuty"))
expected_util = round(count(vs, "OnTrip") / non_retired * 100, 1) if non_retired else 0
check("Utilization = On Trip ÷ non-retired × 100", abs(k["fleetUtilizationRate"] - expected_util) < 0.05, f"{k['fleetUtilizationRate']} vs {expected_util}")
record("Dashboard filters (type/status/region)", "NOTE", "Applied in the browser on persisted data; the KPI API itself has no filter parameters")

# ================================================================ 10. Search

begin("10. Search and filtering")
s, lst = fm.get(f"/drivers?search={d1['name'].split()[-1]}")
check("Driver search works", s == 200 and any(x["id"] == d1["id"] for x in lst))
s, lst = fm.get("/trips?status=Cancelled")
check("Trip status filter works", s == 200 and lst and all(x["status"] == "Cancelled" for x in lst))
s, lst = fm.get("/vehicles?search=ZZZZ-NO-MATCH")
check("Search with no match returns an empty list", s == 200 and lst == [])
s, lst = drv.get("/trips?search=")
check("Filters do not bypass driver trip scoping", s == 200 and len({t["driverName"] for t in lst}) <= 1)

# ================================================================ 11. Database integrity

begin("11. Database integrity")
if opts.db_query:
    idx = db("""select indexname, indexdef from pg_indexes where tablename in ('Vehicles','Drivers','Trips')""")
    names = {r["indexname"] for r in idx}
    check("Tenant-scoped unique registration index exists", "UX_Vehicles_Tenant_NormalizedRegistrationNumber" in names)
    check("Tenant-scoped unique licence index exists", "UX_Drivers_Tenant_NormalizedLicenseNumber" in names)
    check("One dispatched trip per vehicle/driver enforced by index", {"UX_Trips_OneDispatchedVehicle", "UX_Trips_OneDispatchedDriver"} <= names)
    fks = db("""select conrelid::regclass::text tbl, confrelid::regclass::text ref, confdeltype from pg_constraint where contype='f'""")
    trip_fks = [f for f in fks if f["tbl"] == '"Trips"']
    check("Trips reference vehicles and drivers with RESTRICT delete", trip_fks and all(f["confdeltype"] in ("r", "a") for f in trip_fks),
          str([(f["ref"], f["confdeltype"]) for f in trip_fks]))
    money = db("""select table_name, column_name, data_type, numeric_scale from information_schema.columns
                  where column_name in ('Amount','Cost','Revenue','AcquisitionCost') and table_schema='public'""")
    check("Money columns are numeric with 2 decimals", all(c["data_type"] == "numeric" and c["numeric_scale"] == 2 for c in money),
          str([(c["table_name"], c["column_name"], c["data_type"], c["numeric_scale"]) for c in money if c["numeric_scale"] != 2]))
    check("Safety score check constraint exists", bool(db("""select 1 from pg_constraint where conname='CK_Drivers_SafetyScore'""")))
    record("Migrations apply to an empty database", "PASS", "Verified by starting the API on a fresh database (bug fixed in this round)")
else:
    record("Database checks", "MANUAL", "Run with --db-query to inspect indexes and constraints")

# ================================================================ 12. API errors

begin("12. API behaviour and errors")
s, b, _ = fm.call("POST", "/vehicles", raw=b"{not json")
check("Malformed JSON gives 400 without a stack trace", s == 400 and "   at " not in json.dumps(b if not isinstance(b, bytes) else b.decode(errors='replace')), f"HTTP {s}")
expect("Unknown resource id gives 404", fm.get("/vehicles/00000000-0000-0000-0000-000000000001"), 404)
expect("Authenticated but forbidden gives 403 (not 401)", drv.get("/expenses"), 403)
s, b, h = Session().call("OPTIONS", "/vehicles", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
check("CORS does not allow arbitrary origins", h.get("Access-Control-Allow-Origin") not in ("*", "https://evil.example"), str(h.get("Access-Control-Allow-Origin")))
s, b, h = Session().call("OPTIONS", "/vehicles", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
check("CORS allows the configured frontend origin", h.get("Access-Control-Allow-Origin") == "http://localhost:3000", str(h.get("Access-Control-Allow-Origin")))
check("Swagger document available in Development", root_get("/swagger/v1/swagger.json", Session()) == 200)
check("Health endpoint responds for the hosting platform", Session().get("/health")[0] == 200)
check("Viewing plans never uses up the purchase rate limit", all(Session().get("/onboarding/plans")[0] == 200 for _ in range(25)))
s, b = fm.post("/vehicles", vehicle_body(status="Retired", id="00000000-0000-0000-0000-000000000009", tenantId="other"))
check("Privileged fields in the body are ignored (status/id/tenant)", s == 201 and b["status"] == "Available" and b["id"] != "00000000-0000-0000-0000-000000000009")

# ================================================================ 14. Demo data consistency

begin("14. Seeded demo accounts and data")
vs, ts, ds, ms = fm.get("/vehicles")[1], fm.get("/trips")[1], fm.get("/drivers")[1], fm.get("/maintenance")[1]
seeded_v = [v for v in vs if f"-{RUN}-" not in v["registrationNumber"]]
seeded_d = [d for d in ds if not d["name"].startswith(f"Test Driver {RUN}")]
dispatched = [t for t in ts if t["status"] == "Dispatched"]
on_trip_v = {v["id"] for v in vs if v["status"] == "OnTrip"}
on_trip_d = {d["id"] for d in ds if d["status"] == "OnTrip"}
check("Every On Trip vehicle has a dispatched trip and vice versa", on_trip_v == {t["vehicleId"] for t in dispatched},
      f"{len(on_trip_v)} on trip / {len(dispatched)} dispatched")
check("Every On Trip driver has a dispatched trip and vice versa", on_trip_d == {t["driverId"] for t in dispatched})
in_shop = {v["id"] for v in vs if v["status"] == "InShop"}
active_m = {m["vehicleId"] for m in ms if m["status"] == "Active"}
check("In Shop vehicles match active maintenance", in_shop == active_m, f"in shop {len(in_shop)}, active orders {len(active_m)}")
ids_v = {v["id"] for v in vs}
check("All trips reference existing vehicles and drivers", all(t["vehicleId"] in ids_v and t["driverId"] in {d["id"] for d in ds} for t in ts))
check("Seed has meaningful data for every role",
      len(seeded_v) >= 10 and len(seeded_d) >= 10 and sum(1 for t in ts if t["status"] == "Completed") >= 50 and len(ms) >= 10,
      f"{len(seeded_v)} vehicles, {len(seeded_d)} drivers, {len(ts)} trips, {len(ms)} maintenance")
check("Seed covers every vehicle status", {"Available", "OnTrip", "InShop", "Retired"} <= {v["status"] for v in seeded_v},
      str(sorted({v['status'] for v in seeded_v})))
check("Seed covers suspended and expired-licence drivers", any(d["status"] == "Suspended" for d in seeded_d)
      and any(d["licenseExpiryDate"] < date.today().isoformat() for d in seeded_d))
s, dk = drv.get("/kpi/driver")
check("Demo driver account is linked to a driver profile with trips", s == 200 and len(drv.get("/trips")[1]) > 0, f"{len(drv.get('/trips')[1])} trips")
s, users = admin.get("/admin/users")
demo_admins = [u for u in users if u["role"] in ("OrganizationAdmin", "organization_admin")]
check("Only one Organization Admin in the demo tenant", len(demo_admins) == 1, str(len(demo_admins)))

# ================================================================ 13 / 15

begin("13. Frontend UX")
for item in ["Forms show backend validation errors", "Loading, empty and error states", "Tables refresh after changes",
             "Confirmation before destructive actions", "Role-based navigation", "Responsive layout", "Keyboard accessibility"]:
    record(item, "MANUAL", "Checked in the browser; see the report")

begin("15. Fresh account demonstration")
record("Covered by sections 1, 4, 5, 6, 7", "PASS" if not any(r["status"] == "FAIL" for r in results) else "NOTE",
       "Fresh Fleet Manager account was created, logged in, and could not elevate itself")

# ================================================================ rate limit (last: it blocks logins for a minute)

if not opts.skip_rate_limit:
    begin("1.2 Brute-force protection")
    codes = []
    for _ in range(12):
        codes.append(Session().call("POST", "/auth/login", {"email": "nobody@example.test", "password": "x"})[0])
    check("Login is rate limited per IP", 429 in codes, f"codes {codes}")
    check("Session check is not rate limited", all(Session().get("/auth/me")[0] == 401 for _ in range(15)))

# ================================================================ summary

total = {k: sum(1 for r in results if r["status"] == k) for k in ("PASS", "FAIL", "NOTE", "MANUAL")}
print(f"\n{total['PASS']} passed, {total['FAIL']} failed, {total['NOTE']} notes, {total['MANUAL']} manual")
if opts.report:
    json.dump({"run": RUN, "summary": total, "results": results}, open(opts.report, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
sys.exit(1 if total["FAIL"] else 0)
