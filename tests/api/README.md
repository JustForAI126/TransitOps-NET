# API checklist tests

`checklist.py` exercises the running API against the project test checklist: authentication,
role permissions, KPIs, vehicles, drivers, trips, maintenance, expenses, reports, search,
database constraints, error handling and the seeded demo data. It needs only Python 3.10+.

**Run it against a disposable database only.** It creates vehicles, drivers, trips, users and
expenses, locks out a throwaway account, and deliberately trips the login rate limit at the end.

## One-time setup

```
npm --prefix tools/testdb install
```

## Run

Use three terminals from the repository root:

1. Portable PostgreSQL on port 5433 (`--reset` starts from an empty database):
   ```
   node tools/testdb/start.mjs --reset
   ```
2. Mail catcher on port 2525 (emails are saved to `tools/mailsink/messages/` instead of being sent):
   ```
   python tools/mailsink/mailsink.py
   ```
3. The API on http://localhost:5000, pointed at the two services above:
   ```
   powershell -File tools/run-api-testdb.ps1
   ```

Then run the checks with the same demo password the API was started with (`DemoAccounts:Password`):

```
python tests/api/checklist.py --password "<demo password>" --db-query "node tools/testdb/dbquery.mjs" --report test-report.json
```

The exit code is non-zero when any check fails. Results are marked:

| Mark | Meaning |
|---|---|
| PASS / FAIL | Automated check result |
| NOTE | Behaviour worth knowing that is not a failure (e.g. an optional feature that is not implemented) |
| MANUAL | Needs a person in the browser (layout, accessibility) |

The frontend (`npm --prefix frontend run dev`) also talks to the API on port 5000, so the browser
uses the test database too while this setup is running.
