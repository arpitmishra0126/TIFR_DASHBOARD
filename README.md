# ICMR Neurodevelopment Dashboard — V1

Dashboard for the ICMR Neurodevelopment study. REDCap is the production
source of truth; this application consumes REDCap data through the REDCap
API, normalizes it into PostgreSQL, and serves it to a React dashboard.

```
REDCap → REDCap API → ingestion/normalization → PostgreSQL → FastAPI → React UI
```

PostgreSQL is the application's normalized data/cache layer, not a
replacement for REDCap.

## Current status

This is the **V1 technical foundation**: project structure, backend/frontend
scaffolding, database models, dashboard-facing schemas, API routes, and the
REDCap integration boundary. It is **not yet connected to REDCap** —
`REDCAP_API_URL` / `REDCAP_API_TOKEN` / `REDCAP_PROJECT_ID` are unset, and no
REDCap data has been ingested. No mock data has been created anywhere in the
codebase; all list endpoints will return empty results until real data is
ingested.

## V1 scope

Modules: Registry / Study Overview, Demographics & SES, Health & Screening,
Physical Activity, Screen Time, Neurodevelopment / Assessment, Assessment
Progress / Funnel.

Nutrition is deferred — the approved V1 variable specification
(`data/ICMR_Neurodevelopment_Dashboard_V1_Variable_Spec.docx`) has no
dashboard-ready nutrition summary metric.

The **only** dashboard variable contract for V1 is that spec document. The
reference files in `data/` (the spec and the REDCap DATA_LABELS CSV export)
are read-only reference material and must not be modified or used as a
production data source.

## Repository structure

```
data/                       # reference files only — read-only, not a data source
backend/
  app/
    config.py                # environment-based settings
    database.py               # SQLAlchemy engine/session, Base
    models/                   # SQLAlchemy ORM models, one file per module
    schemas/                  # dashboard-facing Pydantic response schemas
    api/routes/                # FastAPI routers, one file per module + health
    services/                  # data/service layer between routes and models
    redcap/                    # REDCap API client, exceptions, response models
    ingestion/                  # normalization helpers + REDCap field-label map
    core/                       # logging setup
    main.py                     # FastAPI app entrypoint
  scripts/init_db.py            # creates tables from SQLAlchemy metadata
  tests/                        # pytest suite
  requirements.txt
  .env.example
frontend/
  src/
    routes/                    # one page per dashboard module
    components/                 # Layout/nav
    api/client.ts                # typed fetch wrapper
    types/dashboard.ts            # TS types mirroring backend schemas
  package.json
  .env.example
```

## Backend — setup & run

Requires Python 3.11+ (developed against 3.14) and PostgreSQL.

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # then edit DATABASE_URL; leave REDCAP_* blank for now
python -m scripts.init_db       # creates tables in PostgreSQL (requires a running instance)
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/api/v1/health

## Backend — tests

```bash
cd backend
./.venv/Scripts/python.exe -m pytest -v
```

Model/schema tests run against an in-memory SQLite database, so they don't
require PostgreSQL to be running. 14 tests currently pass.

## Frontend — setup & run

Requires Node 18+ (developed against Node 24).

```bash
cd frontend
npm install
cp .env.example .env            # points at the local backend by default
npm run dev
```

App: http://localhost:5173

`npm run build` runs the TypeScript project build followed by the Vite
production build.

## REDCap integration — what's built vs. what's blocked

Built: `app/redcap/client.py` (authenticated, retrying REDCap API client for
record + metadata export), `app/redcap/exceptions.py`, and
`app/ingestion/field_map.py` + `app/ingestion/normalize.py` (the V1 field
contract and pure transform helpers).

Blocked until credentials are supplied:

- `REDCAP_API_URL`, `REDCAP_API_TOKEN`, `REDCAP_PROJECT_ID`
- The REDCap **Data Dictionary** (metadata) export — the only REDCap export
  available so far is a DATA_LABELS export, which has no real REDCap
  variable names, only question-label text. `app/ingestion/field_map.py`
  documents this limitation directly; the field map must be re-keyed to real
  variable names once the Data Dictionary is available.
- Confirmation of whether the Parent-report / Child self-report / Teacher
  Social Skills instruments are repeating instruments or separate events in
  the live REDCap project.

No live REDCap connection is made anywhere in the codebase, and no REDCap or
dashboard data has been fabricated.
