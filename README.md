# ICMR Neurodevelopment Dashboard — V1

Live dashboard for the ICMR Neurodevelopment study. REDCap is the production
source of truth; this application reads directly from the REDCap API,
normalizes/aggregates in memory, and serves it to a React dashboard.

```
REDCap → REDCap API → FastAPI (in-memory normalization/aggregation) → React UI
```

There is **no database**. No PostgreSQL, SQLite, or ORM persistence layer is
used anywhere in this project — see `CLAUDE.md` for the authoritative
architecture rule.

## Current status

The application is connected to **live REDCap data** (project: ICMR
Neurodevelopment Study). `REDCAP_API_URL` / `REDCAP_API_TOKEN` must be
supplied via environment variables (see `.env.example`); the app does not
start meaningfully without them. No mock/fabricated data is used anywhere in
the codebase. See `CLAUDE.md` for full current architecture, module, and
export-feature documentation — it is the living source of truth for this
project.

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
    schemas/                  # dashboard-facing Pydantic response schemas
    api/routes/                # FastAPI routers, one file per module + health
    services/                  # data/service layer (live REDCap aggregation, export)
    redcap/                    # REDCap API client, live repository/cache, exceptions
    ingestion/                  # normalization helpers + live REDCap field map
    core/                       # logging setup
    main.py                     # FastAPI app entrypoint
  tests/                        # pytest suite
  requirements.txt
  .env.example
frontend/
  src/
    routes/                    # one page per dashboard module
    components/                 # Layout/nav
    api/client.ts                # typed fetch wrapper
    types/                       # TS types mirroring backend schemas
  package.json
  .env.example
render.yaml                  # Render deployment blueprint (backend + frontend)
```

## Backend — setup & run

Requires Python 3.11+ (developed against 3.14). No database required.

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # then set REDCAP_API_URL / REDCAP_API_TOKEN
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/api/v1/health

## Backend — tests

```bash
cd backend
./.venv/Scripts/python.exe -m pytest -v
```

105 tests currently pass. No database is required to run the suite.

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

## REDCap integration

The application connects live to REDCap project **196 (ICMR Neurodevelopment
Study)** via `app/redcap/client.py` + `app/redcap/live_repository.py` (a
30-second in-memory cache over record/metadata export). Requires
`REDCAP_API_URL` and `REDCAP_API_TOKEN`; `REDCAP_PROJECT_ID` is optional
bookkeeping only. See `CLAUDE.md` for the full field-mapping/instrument
documentation.

## Deployment

See `render.yaml` for the Render blueprint (backend Web Service + frontend
Static Site). Required environment variables and deployment steps are
documented in `CLAUDE.md`.
