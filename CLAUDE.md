# ICMR Neurodevelopment Dashboard — Project Context

## PROJECT PURPOSE

This is a live clinical/research dashboard for the ICMR Neurodevelopment Study.

The dashboard reads data DIRECTLY from REDCap.

Architecture:

REDCap API
→ FastAPI backend
→ in-memory normalization/aggregation
→ React + TypeScript + Recharts frontend

## ABSOLUTE ARCHITECTURE RULE

THERE IS NO DATABASE.

Do not introduce PostgreSQL, SQLite, SQLAlchemy, ORM persistence, or any other database.

REDCap is the source of truth.

Credentials are supplied through environment variables:

REDCAP_API_URL
REDCAP_API_TOKEN

Do not hardcode credentials or participant data.

---

## DEPLOYMENT (Render) — PREPARED 2026-09-01, NOT YET DEPLOYED

`render.yaml` (repo root) defines two Render services matching the existing
architecture exactly — no database service, no new backend logic:

- **`icmr-dashboard-backend`** — Web Service, `env: python`, `rootDir: backend`.
  Build: `pip install -r requirements.txt`. Start:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (existing entrypoint,
  unmodified). Env vars `REDCAP_API_URL`, `REDCAP_API_TOKEN`,
  `CORS_ALLOW_ORIGINS` are `sync: false` (must be entered manually in the
  Render dashboard — never committed); `ENVIRONMENT=production` and
  `LOG_LEVEL=INFO` are set inline (non-secret).
- **`icmr-dashboard-frontend`** — Static Site, `env: static`,
  `rootDir: frontend`. Build: `npm install && npm run build`. Publish:
  `./dist`. Env var `VITE_API_BASE_URL` (`sync: false`, manual) must be set to
  `https://<backend-service>.onrender.com/api/v1`. A catch-all rewrite
  (`/* -> /index.html`) is configured so direct navigation/refresh on any
  client-side route (e.g. `/registry`, `/health-screening`) doesn't 404 —
  required because `frontend/src/main.tsx` uses React Router's `BrowserRouter`.

No application code changed to support this — `frontend/src/api/client.ts`
already reads `import.meta.env.VITE_API_BASE_URL` (falling back to
`http://localhost:8000/api/v1` only for local dev, never committed as a prod
value), and `backend/app/config.py` already supports multiple comma-separated
CORS origins via `CORS_ALLOW_ORIGINS`, so both localhost and the deployed
Render frontend URL can be allowed simultaneously.

`backend/.env.example` was cleaned up: removed a stale, unused
`DATABASE_URL` line left over from the pre-REDCap V1 scaffold (never read by
any current code — `app/config.py` has no such field); this was a
documentation fix only, not a behavior change. `README.md` was also
corrected to match this section (it previously described the obsolete
PostgreSQL-based V1 architecture).

Actual current routes (for reference — task briefs sometimes list slightly
different paths): `/`, `/registry`, `/demographics`, `/health-screening`
(page title "Child Illness History" since 2026-09-03 — route/path unchanged),
`/physical-activity`, `/screen-time`, `/dietary-intake` (new 2026-09-03),
`/assessments` (new 2026-09-03 — "All Study Instruments" hub), `/neurodevelopment`,
`/progress` — all under `frontend/src/App.tsx`.

Verified before this config was written (2026-09-01): backend 105/105 tests
pass; frontend `npm run build` succeeds; a temporary local backend instance
confirmed live REDCap data on `/health`, `/overview`, `/registry`, all four
assessment-module endpoints, and both export endpoints (200 OK, real live
counts e.g. core assessment battery 32/212 at time of check — expected to
keep changing as REDCap data grows). No `.env` files are tracked in git
(confirmed via `git ls-files`); only `.env.example` is tracked.

Deployment itself (clicking deploy, entering secrets into Render) was
intentionally NOT performed — prepared for manual review/execution by the
user.

---

## CORRECT REDCAP PROJECT

Project:
ICMR Neurodevelopment Study

Project ID:
196

The application must use whatever REDCAP_API_URL and REDCAP_API_TOKEN are configured to access this project.

DO NOT hardcode PID 196 into business logic. (It appears only in code comments/docstrings as documentation of what was verified against live metadata — never in a conditional or as a request parameter.)

Previous PID 200 data was from the wrong project and must NOT be used.

Old values such as:

2157
172
122
70
67

belonged to the wrong project and must never be reintroduced.

---

## CURRENT REDCAP INSTRUMENTS

The correct project contains these 9 instruments:

1. Registration
2. SES
3. DSEQ
4. Child Illness History
5. PAQ-A
6. Dietary Intake
7. SSRS Parent
8. SSRS Child
9. SSRS Teacher

The project is classic/non-longitudinal.

Field-level content is mapped into the **dashboard modules** (Overview/Registry/Demographics/Progress) for **Registration** and **SES** only — the other 6 instruments still show only completion status there. Separately, the **Active Cases Excel export** (see EXPORT FEATURE below) additionally reads real acquired/derived field-level data from **DSEQ, Child Illness History, PAQ-A, and Dietary Intake** (approved per the 2026-08-26 field audit) — this is export-only and does not change any dashboard module or calculation. SSRS Parent/Child/Teacher remain completion-status-only everywhere (dashboard and export) — their item-level data is mostly empty in the live project today and was not approved for export. See `backend/app/ingestion/live_field_map.py` for the dashboard field-availability ledger and `backend/app/services/export_service.py`'s `ACTIVE_CASES_FIELD_SPECS` for the export's field-by-field documentation.

---

## CORE ASSESSMENT BATTERY

Core Assessment Battery means ALL SIX of these instruments are complete for the same child:

- SES
- DSEQ
- Child Illness History
- PAQ-A
- Dietary Intake
- SSRS Parent

Completion is determined dynamically from the REDCap instrument completion fields.

REDCap completion value:

"2" = Complete

Do not hardcode participant counts.

---

## CURRENT LIVE DATA OBSERVATION

The current live project has approximately (checked 2026-09-03):

Registered: 212
Core REDCap Instruments Completed (formerly "Core Assessment Battery" internally, "Completed Assessment Set" in the UI — see 2026-09-03 REVISION section): 33
SSRS Child after Core instruments: 21
SSRS Teacher after SSRS Child: 0

These are LIVE observations, NOT constants.

They must always be calculated dynamically from REDCap.

The numbers may change as REDCap data changes.

---

## PROGRESSION LOGIC

Assessment progression is cumulative:

Registered
↓
Core Assessment Battery
↓
SSRS Child
↓
SSRS Teacher

SSRS Child count:

children who completed ALL six Core Assessment instruments
AND completed SSRS Child.

SSRS Teacher count:

children who satisfy the SSRS Child stage
AND completed SSRS Teacher.

Do not count later-stage instruments independently of the preceding stages.

---

## ACTIVE CASE DEFINITION (confirmed)

A child is an **active case** if `baby_status` (registration_form, binary Live/Dead radio) is **not** "Dead". A blank/unset status counts as active, since REDCap does not default a new record to Dead.

This is the only status-like field in the live project — there is no multi-state "active/withdrawn/lost-to-follow-up" field. Confirmed with the user 2026-08-26. Implemented in `backend/app/services/export_service.py` (`_is_active`).

---

## IMPORTANT DATA RULES

Never:

- hardcode participant counts
- create mock production data
- substitute unrelated REDCap variables
- assume a variable exists without checking metadata
- use PID 200 fields/data
- introduce a database
- modify backend architecture unnecessarily

If a metric is unavailable:

say it is unavailable.

Do not fabricate a value.

---

## 2026-09-03 REVISION — SENIOR REQUIREMENTS AUDIT + IMPLEMENTATION

A full audit (against live REDCap metadata/data, read-only) was run against a
senior stakeholder's requested revisions, then implemented. Backend
**121/121** tests pass (up from 105 — new tests cover the additions below);
frontend `tsc --noEmit` and `npm run build` both succeed. Verified live
against REDCap (212 registered) after implementation.

**Age**: replaced the old 0-4/5-9/10-14/15+ bands everywhere (Overview,
Demographics, the Demographics age filter) with study-specific exact-year
groups — "8 years" / "9 years" / "10 years" / "Other (outside 8-10 years)"
(only shown if non-zero) / "Unknown" (only shown if non-zero). Source is
still `child_dob` via the existing `compute_age_years`; the reference date
is unchanged ("as of today") since no REDCap metadata establishes a
different convention — this is now a single named constant
(`_AGE_REFERENCE_DATE` in `live_dashboard_service.py`) so it can be changed
to e.g. each child's `visit_date` later without touching bucket logic. This
remains a **flagged clarification item** — not resolved by this change.

**SES category labels**: Udai Pareek (`scr_pareek_category`) and BG Prasad
(`scr_prasad_category`) are REDCap `calc` fields, so the API never returns a
choice list for them — but both fields' own `field_note` text documents
named categories (confirmed live 2026-09-03: `"1=I Upper >43; 2=II
Upper-middle 33-42; 3=III Middle 24-32; 4=IV Lower-middle 13-23; 5=V Lower
<13"`, same convention for both fields). `app/ingestion/choice_maps.py` now
has `parse_calc_category_note()`/`build_calc_category_maps()`, which parse
this documented convention into a normal `{code: label}` map; the result is
merged into the same `choice_maps` dict used everywhere else
(`LiveDashboardService._load()`), so these two fields resolve to real text
labels ("Upper", "Upper-middle", "Middle", "Lower-middle", "Lower")
anywhere a category is displayed (Overview, Demographics), ordered by the
underlying numeric code (not alphabetically) via the new
`_ordered_labeled_category_distribution()` helper. No label is invented —
a field_note that doesn't match the pattern yields no entry and the raw
code is shown unchanged (same fallback behavior as any other choice field).

**Overview — Child Illness History + DSEQ**: `OverviewResponse` gained
`chh_completion`/`chh_named_conditions`/`chh_general_flags` and
`dseq_completion`/`dseq_screen_time_distribution`, built by reusing the
existing `build_health_screening_analysis()`/`build_screen_time_analysis()`
— no parallel calculation engine. Overview now renders two compact tables
("Reported Health Conditions, n (%)" / "Reported Health and
Medical-History Indicators, n (%)") and a "Distribution of Total Daily
Screen Time" chart, positioned between Study Progress and Data Collection
& Quality Status.

**Named/general CHH indicators — denominator model rewrite**: each item in
`named_conditions`/`general_flags` (`HealthScreeningResponse` and the new
Overview fields) changed from a bare Yes-count (`CategoryCount`) to a full
`ConditionIndicator`: `yes_count`, `no_count`, `dont_know_count`
(surfaced as its own bucket wherever a field's REDCap choices actually
include a "don't know"-shaped option — never inferred for fields that don't
offer it), `valid_n` (children who answered THIS question — the correct
percentage denominator), `asked_n` (children who completed the CHH
instrument — kept as a separate, non-substituted denominator), and
`missing_count` (`asked_n - valid_n`). `percent_yes` is `yes_count /
valid_n`, never `/ asked_n` or `/ total_registered`. New helpers:
`response_breakdown()`, `build_condition_indicator()` in
`module_analytics.py`.

**DSEQ ordinal ordering fix**: `module_analytics.py` gained
`ordered_category_counts()`, which orders a field's categories by REDCap
choice-code order (ascending) instead of `category_counts()`'s
descending-frequency sort, and includes every defined category at zero
count so the full ordinal scale is always visible. `q10_total_screen_time`
(DSEQ Screen Time page and the new Overview DSEQ section) now uses this —
confirmed live: `<30min(8) → 30min-1h(12) → 1-2h(13) → 2-4h(1) → >4h(0)`,
correctly ascending instead of the old descending-by-count order. The
Active Cases Excel/CSV export's own Summary-sheet chart for this field is
**unchanged** (still frequency-sorted via `category_counts()`) — out of
scope, same precedent as the export's frozen "Core Assessment Battery"
wording.

**Dietary Intake dashboard (new)**: previously export-only. New
`build_dietary_analysis()` in `module_analytics.py` (reuses the existing
`DIETARY_LABELS`/`ordered_category_counts`), new `DietaryFoodItem`/
`DietaryIntakeResponse` schemas, new `LiveDashboardService.get_dietary_intake()`,
new `GET /api/v1/dashboard/dietary-intake` endpoint, new
`frontend/src/routes/DietaryIntake.tsx` page (route `/dietary-intake`) — one
compact chart per food group with n/N/% and category order preserved.

**"Completed Assessment Set" → "Core REDCap Instruments Completed"**: this
UI label (Overview KPI card, Overview footnote, Assessment Progress funnel
stage + instrument-table title) is renamed again — the six-instrument
intersection is a genuine, justified dashboard-level grouping (it gates the
SSRS Child/Teacher funnel stages), so this name honestly describes what it
measures without implying a validated clinical milestone. Internal
identifiers (`core_assessment_count`, stage key `core_assessment_battery`,
`CORE_BATTERY_*` constants) are unchanged. The Excel/CSV export still says
"Core Assessment Battery" — unchanged, out of scope (same established
precedent as the prior rename).

**Terminology renames applied** (dashboard UI only — the Active Cases
Excel/CSV export's own headers/chart titles are deliberately unchanged,
same precedent as above):
- "Health & Screening" → "Child Illness History" (page title, nav item;
  route `/health-screening` and the API path `/dashboard/health` are
  unchanged — only user-facing text moved).
- "Average Total Daily Screen Time" → "Distribution of Total Daily Screen
  Time" (Screen Time page section + chart title; also used on the new
  Overview DSEQ section).
- Module-status badges (Health & Screening / Screen Time / Physical
  Activity / Dietary Intake pages) changed from an ambiguous `"{tier}
  coverage"` badge (e.g. "Partial coverage") to `"Instrument Completion:
  n/N (%)"`.
- PhysicalActivity.tsx's invented subtitle gloss "Physical Activity
  Questionnaire for Adolescents" (not present anywhere in REDCap metadata —
  the live REDCap instrument label is literally "PAQ A") was removed and
  replaced with a neutral, metadata-accurate subtitle. No UI claim was
  added resolving whether PAQ-A or PAQ-C is the more age-appropriate
  version for this ~9-10-year-old cohort — that remains an open
  confirmation item for the study team, not a code decision.

**Assessment instrument structure (new)**: `frontend/src/routes/AssessmentsHub.tsx`
(route `/assessments`, linked from the nav's Assessments dropdown as "All
Study Instruments") lists all instruments the study team named. The 9
that exist in REDCap link to their existing pages (Registration→Registry,
SES→Demographics, CHH→Child Illness History page, DSEQ→Screen Time,
PAQ→Physical Activity, Dietary Intake, SSRS Parent/Child/Teacher→
Neurodevelopment). The 6 that do **not** exist in REDCap today (ASER
Literacy and Numeracy, SANGIAN, Visual Working Memory, DCCS, Colour
Detection Task, Anthropometry/BIA) render as clickable "Under Development"
placeholder cards — clicking expands an inline panel reading "Under
Development / Data for this assessment is not currently available in the
dashboard." No route navigation, no API call, no fake chart or zero-filled
statistic is produced for these six; this is a UI/product-status
representation only and does not imply any of the six exist in REDCap.

**Known data characteristic (not a bug, flagged for the study team)**: the
10 Dietary Intake frequency fields' (`die_*_freq`) REDCap choice labels are
**Hindi-only** (no English segment at all, confirmed live 2026-09-03 —
unlike most other bilingual fields in this project, which are "English
/Hindi"). `choice_maps.py`'s English-segment extraction has nothing English
to extract for these, so the Dietary Intake page currently displays these
category labels in Hindi, exactly as REDCap defines them — no English
label was invented. This needs a study-team decision (translate on the
REDCap form, or accept Hindi-only category labels on this one page).

---

## FRONTEND STRUCTURE

**Navigation redesign (2026-09-01, two passes):** the persistent left
sidebar was replaced with a **top navigation bar**
(`frontend/src/components/Layout.tsx`, rewritten; the collapsible-sidebar
mechanic and its ~270 lines of CSS were removed, not preserved as dead
code). A same-day follow-up pass restructured it into two stacked rows —
brand identity on top, nav centered below — and trimmed the nav items:

```
ICMR Neurodevelopment Study Dashboard
     [ Overview | Registry | Assessments ▾ | Progress ]
```

- Row 1 (`.topnav-header-row`): brand mark/title (left), live-REDCap badge
  (right on desktop), mobile menu button (right, mobile only).
- Row 2 (`.topnav-links`): centered nav — Overview, Registry, Assessments
  dropdown, Progress. **"Exports" was removed as a separate nav item** — it
  pointed at the same `/registry` route as "Registry" already does, so it
  was redundant; there is still no separate exports page/route, and the
  Export Active Cases (Excel/CSV) buttons still live only on the Registry
  page, unchanged.
- "Assessments" is a click-toggle dropdown (closes on outside click, on
  navigation) listing **3** modules: Health & Screening, Physical Activity,
  Screen Time. **Neurodevelopment was deliberately removed from this nav
  list** (information-architecture decision only) — its route
  (`/neurodevelopment`), page component, and backend endpoint are
  completely unchanged and still fully reachable by URL; live-verified
  200 OK after this change. Do not delete or further hide it without being
  asked.

All 8 existing routes/paths are unchanged; only `Layout.tsx` and `app.css`
changed. Below ~900px, row 2 and the live badge hide and the mobile
hamburger menu (`.topnav-mobile-menu`) takes over, listing the same
(now-7-link) set flattened, Assessments as a labeled sub-group. No
horizontal overflow on narrow screens (nav wraps via `flex-wrap: wrap` on
desktop widths where it doesn't yet hit the mobile breakpoint).
**Header consolidation (2026-09-01, third pass):** `Topbar.tsx` (refresh
button, last-updated, theme toggle) moved from floating at the top of
`app-content` (a separate bar above every page's own `PageHeader`) into
`.topnav-header-row` itself, next to the brand and live badge — one
cohesive branded header instead of a page-content bar that felt like a
separate application shell. `Topbar.tsx`'s internal logic is unchanged
(still reads `useRefresh`/`useTheme` the same way); only where it renders
moved, plus its refresh-button label text was wrapped in a
`.refresh-button-label` span (structural only, no behavior change) so it
can be hidden below 900px — at that width the header keeps the refresh and
theme-toggle buttons as icon-only controls (functionality preserved) and
drops the last-updated text and nav links in favor of the hamburger menu.
Brand title truncates with an ellipsis rather than wrapping/overflowing on
very narrow screens.

The dashboard should look like a polished modern clinical/research analytics dashboard, not a Streamlit/admin template.

**Loading/error state (2026-09-01):** every page that fetches live REDCap
data (Overview, Registry, Demographics, Assessment Progress, and all 4
assessment modules) now uses two small reusable components instead of the
old plain `<p className="loading-text">Loading…</p>` /
`<p className="error-text">...</p>` text:

- `frontend/src/components/StudyDataLoader.tsx` — a compact "study data /
  neural network" loader: an inline SVG hexagon-ring of 6 nodes with a
  looping dash animation tracing the ring (`.study-loader-flow`) and nodes
  that pulse in sequence (staggered `animation-delay`), plus "Loading study
  data" / "Connecting to live REDCap data…" / "Preparing dashboard" text
  (all overridable via props). Occupies only its own vertical space — no
  full-screen takeover. All animation is CSS-only, wrapped in
  `@media (prefers-reduced-motion: no-preference)`, so a reduced-motion
  preference yields a fully static hexagon instead of no loader at all.
  Animation duration is fixed regardless of how long the request takes —
  deliberately does not escalate/intensify on a slow request.
- `frontend/src/components/DataLoadError.tsx` — the error state, now with a
  **Retry** button (reuses the existing `.refresh-button` style) that
  re-triggers that page's own fetch via a local `retryCount` state included
  in the page's `useEffect` dependency array. This does not call the
  global "Refresh data" REDCap-cache-busting action — it's a plain re-fetch
  of the same (possibly still-cached) data, appropriate for recovering from
  a transient network/request failure.

Old `.loading-text` CSS rule was removed (no longer referenced anywhere).
No REDCap API logic, dashboard calculations, or routes were touched — this
is purely a loading/error UI change, reused identically across all 8 pages
that fetch live data. Verified: frontend `tsc --noEmit` and `npm run build`
both succeed; a temporary local backend + `vite preview` of the production
build served the app with 200 OK and valid HTML. `StudyDataLoader` /
`DataLoadError` were already in place from this pass — a later refinement
pass (same day) reused them unchanged; no loader rework was needed.

**Content trim for senior-facing readability (2026-09-01, same day):**
removed long implementation/governance-note paragraphs that were rendering
directly in the UI — e.g. Health & Screening's/Screen Time's
`data.notes.scope`, Physical Activity's `data.notes.scores`,
Neurodevelopment's `data.notes.scope`/`data.notes.ssrs_teacher` (dated
approval notes, Excel-export cross-references, field-availability caveats).
The underlying `notes` fields **still exist unchanged in the API
responses** (`backend/app/schemas/dashboard.py`) — only the frontend
`<p className="chart-card-note">{data.notes.x}</p>` lines that rendered
them were removed from `HealthScreening.tsx`, `PhysicalActivity.tsx`,
`ScreenTime.tsx`, `Neurodevelopment.tsx`. Also replaced the raw
full-precision score-range sublabel (e.g. "n=31/212 acquired (14.6%) ·
range 1.1111111111111112–1.5555555555555556") with a concise
"31 participants · 14.6% coverage" in `PhysicalActivity.tsx`'s and
`Neurodevelopment.tsx`'s local `scoreSublabel()` helpers — `percent_valid`
was already rounded server-side; only the unrounded `minimum`/`maximum`
range clause was dropped from display (those raw values are still in the
API response for anyone who needs them, just not shown on this page).
`SectionHeader`/`ChartCard` note props with genuinely interpretive text
(e.g. "DSEQ Q10, among children who completed the instrument") were kept —
only internal-process/documentation-style paragraphs were removed.
Demographics' short per-chart notes (e.g. explaining Udai Pareek/BG Prasad
are numeric category codes) were left as-is — same day, out of scope for
this pass, and short/attached rather than a standalone long paragraph.

---

## PAGE RESPONSIBILITIES

### Overview

Study-level summary.

Show, as separate top-level KPI cards (kept deliberately small in number —
NOT one per instrument), each independently live-calculated from REDCap:

- Registered
- Core REDCap Instruments Completed (**UI label only** — see "UI TERMINOLOGY" below;
  underlying strict all-six-instruments calculation is unchanged)
- SSRS Parent
- SSRS Child
- SSRS Teacher

**Overview restructure (2026-09-01, second pass — analytical layout):**
below the "Study snapshot" KPI row, the page now has four further
sections, each answering a distinct question (no section repeats another's
numbers in more than one additional format):

- **Study Profile** (new) — three compact charts using `OverviewResponse`
  fields that were already being fetched but not charted on this page:
  `sex_distribution` as a donut (new `frontend/src/components/DonutChart.tsx`
  — thin Recharts `Pie`/`Cell` wrapper matching the existing chart
  components' styling conventions; recharts was already a dependency, no
  new chart library added), `age_distribution` as a bar chart (existing
  `CategoryBarChart`, `mode="sequential"`), and
  `udai_pareek_category_distribution` as a horizontal bar chart (existing
  `HorizontalBarChart`) — the same data Demographics also charts, shown
  here as a compact population snapshot rather than the detailed page.
- **Assessment Coverage** — the previous 9-row `CoverageBar` panel (9 large
  progress bars, visually repetitive) was replaced with a **compact table**
  (reuses the existing `.table-card`/`table.data-table` styling from the
  Registry page — no new table component) — one row per instrument:
  Assessment Instrument | Completed | Coverage | Status
  (`StatusBadge` for High/Partial/No Data). Still all **nine** live
  instruments from `all_instrument_coverage`, still each independently
  calculated from its own `*_complete` field — only the presentation
  changed, not the data or calculation. The old subtle
  Registration/Study Assessments/Social Skills Assessments row-grouping was
  dropped (a flat table doesn't need it); `CoverageBar.tsx` itself is
  unchanged and still used by the Assessment Progress page's own
  instrument breakdown (see below).
- **Study Progress** — unchanged: the `Funnel` component only (registered →
  Completed Assessment Set → SSRS Child → SSRS Teacher), reusing
  `ProgressResponse.stages`. (An earlier pass had already removed a
  duplicate 4-card `ProgressStageCard` KPI grid from this page — see prior
  entry below; `ProgressStageCard.tsx` remains intentionally unused in the
  codebase, kept pending an explicit dead-code-cleanup decision.)
- **Data Collection & Quality Status** — unchanged: the compact
  `.status-stat-grid` panel (total instrument-completions collected, count
  at High coverage, count needing attention, last refresh) plus the
  Partial/No-Data flag list.

Do NOT duplicate detailed demographic analysis here.

Do NOT show the large Module Integration Status section on Overview.

Verified (this pass): backend **113/113** tests pass (unchanged — no
backend files were touched); frontend `tsc --noEmit` and `npm run build`
both succeed. Live-checked against REDCap (212 registered): sex 110
male/102 female/0 unknown, age buckets 0/188/24/0 across 0-4/5-9/10-14/15+,
Udai Pareek categories 3→7, 4→24, 5→1 — all read directly from the live
`/api/v1/dashboard/overview` response. The 9-row coverage table's live
values matched exactly: Registration Form 212/100%/High; SES, DSEQ, Child
Illness History, PAQ-A, Dietary Intake, SSRS Parent each 32/15.09%/Partial;
SSRS Child 17/8.02%/Partial; SSRS Teacher 0/0%/No Data.

**Assessment Progress page:** the duplicate 4-KPI-card row above the funnel
(same numbers as Overview's Snapshot) was removed — the page now opens
directly with the funnel, then the "Completed Assessment Set instruments"
6-row breakdown (unchanged calculation, now also shows `coverage_tier`).

**Assessment module pages (Health & Screening / Physical Activity / Screen
Time):** the standalone "Instrument Completion" `KpiCard` was replaced with
a compact `.module-status-line` (a `StatusBadge` + one line of text) above
each page's real analysis, so the page opens into its actual chart(s)
rather than a one-card preamble. Genuinely distinct KPIs on these pages
(PAQ-A's 3 score summaries, Screen Time's 3 yes/no items) are unchanged.
Neurodevelopment was left as-is — its per-instrument "children with any
data" KPI is a different metric, not a literal completion/tier card, so the
"remove the standalone Instrument Completion KPI" change doesn't apply
there.

#### UI TERMINOLOGY (updated 2026-09-03; originally 2026-09-01)

"Core Assessment Battery" is displayed as **"Core REDCap Instruments
Completed"** (renamed 2026-09-03 from the earlier placeholder "Completed
Assessment Set" — see the 2026-09-03 REVISION section above) in all
user-facing text on the Overview KPI cards, the new Overview footnote, and
the Assessment Progress funnel/stage-instrument-breakdown
(`frontend/src/routes/Overview.tsx`, `frontend/src/routes/AssessmentProgress.tsx`,
and the `ProgressStage.label`/`description` strings built in
`backend/app/services/live_dashboard_service.py::get_progress`/`get_overview`).
This name was chosen because the six-instrument intersection genuinely is a
dashboard-level "core instruments" grouping (it gates the SSRS Child/Teacher
funnel stages) — do not propagate it elsewhere without re-confirming (the
Active Cases Excel/CSV export in `export_service.py` intentionally still
says "Core Assessment Battery" — out of scope for this rename, left
unchanged). The underlying calculation
(all six of SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake, SSRS
Parent complete for the same child — `CORE_BATTERY_COMPLETE_FIELDS`) is
**unchanged**; only the display label moved. Backend field/key names
(`core_assessment_count`, `core_assessment_percent`, stage key
`core_assessment_battery`) were deliberately left as-is — internal
identifiers, not user-facing text.

#### API — Overview instrument data (as of 2026-09-01)

`OverviewResponse` (backend/app/schemas/dashboard.py) carries two distinct
per-instrument breakdowns, both `list[InstrumentCoverage]` (`key`, `label`,
`completed_count`, `percent_of_registered`, and — added 2026-09-01 —
`coverage_tier: "High"|"Partial"|"No Data"`, computed via the
**already-existing** `module_analytics.coverage_tier()` helper, same ≥50%/
>0%/0% thresholds already used by the 4 assessment-module endpoints and the
Excel export's DATA COVERAGE section — no new calculation logic was
introduced, only reuse):

- `instrument_coverage` — the original 6 Completed-Assessment-Set
  instruments only (SES, DSEQ, Child Illness History, PAQ-A, Dietary
  Intake, SSRS Parent). Still used by the Assessment Progress page's
  "Completed Assessment Set instruments" breakdown — unchanged.
- `all_instrument_coverage` — **new**, all 9 live instruments (adds
  Registration Form, SSRS Child, SSRS Teacher), each computed independently
  via `_all_instrument_coverage()` / `ALL_INSTRUMENTS` in
  `live_field_map.py`. Powers the new Overview "Assessment Instrument
  Coverage" panel. SSRS Child/Teacher here are **raw** independent
  completion counts (not gated by Completed-Assessment-Set membership like
  the cumulative `ssrs_child_count`/`ssrs_teacher_count` progression
  fields) — a deliberate difference from the funnel's cumulative logic,
  since this panel answers "how many completed this instrument on its own,"
  not "how many progressed through the pipeline."

`OverviewResponse` also still carries the standalone `ssrs_parent_count`/
`ssrs_parent_percent` fields (added same rename effort) — independently
computed from `ssrs_parent_complete`, not derived from the Completed
Assessment Set. No longer shown as its own top-level KPI card (see above);
its value is also the `ssrs_parent` row in `all_instrument_coverage`. Both
are computed from the same `_unique_ids_with_complete_field(records,
SSRS_PARENT_COMPLETE_FIELD)` call, so they can never diverge.

Verified: backend **113/113** tests pass, including
`test_overview_all_instrument_coverage_includes_all_nine_instruments`,
`test_overview_all_instrument_coverage_counts_are_independent` (uses fixture
record REC004 — `ssrs_parent_complete="2"` but incomplete Dietary Intake —
to prove per-instrument counts never collapse into the Completed Assessment
Set aggregate), a zero-completion percent-formula check, and (2026-09-01)
`test_overview_all_instrument_coverage_includes_coverage_tier` +
`test_overview_instrument_coverage_includes_coverage_tier`. Frontend
`tsc --noEmit` and `npm run build` both succeed. Live-checked against
REDCap (212 registered at time of check): Registration Form 212/100%/High,
SES/DSEQ/Child Illness History/PAQ-A/Dietary Intake/SSRS Parent each
32/15.09%/Partial, SSRS Child 17/8.02%/Partial, SSRS Teacher 0/0%/No Data —
all read directly from the live `/api/v1/dashboard/overview` response, not
asserted from memory. All 8 routes, both export formats (xlsx/csv), and
every dashboard endpoint re-checked with 200 OK against a live local
backend after the navigation/Overview redesign.

### Participants

Operational participant/registry view (`frontend/src/routes/Registry.tsx`).

Contains:

- Child ID
- Sex
- Age
- Village
- registration/status information
- search
- filtering
- pagination
- **"Export Active Cases" button** — see Export Feature section below.

### Assessment Progress

Focus on:

Registered
→ Core Assessment Battery
→ SSRS Child
→ SSRS Teacher

Also show instrument-level completion coverage.

### Demographics & SES

Detailed population analysis.

Use available approved fields such as:

- Sex
- Age
- Village
- Udai Pareek
- BG Prasad
- Per-capita income
- Household size

Do not duplicate this entire analysis on Overview.

### Assessment Modules

Health & Screening
Physical Activity
Screen Time
Neurodevelopment

Use actual REDCap instruments/fields when mapped.

Do not claim an instrument does not exist if it exists in PID 196.

**IMPLEMENTED as real analytics (2026-08-26)** — the Active Cases Excel export's "DOMAIN ANALYSIS" section (see EXPORT FEATURE below) was approved as the official V1 analytical specification, and these four pages now render real live data instead of a placeholder. Source of truth for every metric: `backend/app/services/module_analytics.py` — a shared calculation engine used by BOTH these dashboard endpoints and the Excel export's Summary sheet (export_service.py imports its low-level helpers and field-list constants from this module), so the two can never compute different numbers for the same metric. Population = **all registered children** (same convention as Overview/Demographics/Progress), not "Active Cases" (the export's newsletter-specific scope) — only the underlying arithmetic is shared, not the population filter.

- **Health & Screening** (`/api/v1/dashboard/health`, `HealthScreeningResponse`): Child Illness History instrument completion + 11 named-condition Yes-counts (asthma, heart disease, TB, diabetes, thyroid, anaemia, malnutrition, kidney, liver, recurrent infections, other) + 8 general-flag Yes-counts (currently ill, chronic condition, hospitalised, allergy, vision/hearing difficulty, seizures, developmental diagnosis). No other CHH fields (e.g. health rating, fit-for-assessment) are in the approved dashboard analysis — they're exported in the Excel sheet only.
- **Physical Activity** (`/api/v1/dashboard/physical-activity`, `PhysicalActivityResponse`): PAQ-A instrument completion + Item 1/Item 8/Total score summaries (REDCap-calculated fields `paq_item1_score`/`paq_item8_score`/`paq_total_score`; valid N/missing N/mean/min/max, never treating missing as zero) + a 4-bucket Total score distribution.
- **Screen Time** (`/api/v1/dashboard/screen-time`, `ScreenTimeResponse`): DSEQ instrument completion + Q10 "Average Total Daily Screen Time" distribution + 3 Yes/No items (Q9 household rules, Q14 school use, Q15 entertainment use). Per-item TV/phone/laptop frequency breakdowns exist in the Excel export but are **not** part of the approved dashboard analysis.
- **Neurodevelopment** (`/api/v1/dashboard/neurodevelopment`, `NeurodevelopmentResponse`): SSRS Parent/Child/Teacher, each showing "children with any rating item answered", REDCap completion count, and cohort-level mean-of-per-child-means for the frequency and importance rating scales (same per-child derivation as the Excel export's `<Instrument>: Avg Frequency/Importance Rating` columns, aggregated here with no participant identifiers). Explicitly **not** a validated SSRS composite score. SSRS Teacher (0/212 live completions) shows `valid_n=0`/`mean=null` — computed the same way as Parent/Child, not a special-cased placeholder, so it will populate automatically once real Teacher data exists. The individual SSRS Teacher item ratings (`t43_rating`...`t51_rating`) are **not** part of the approved specification and remain unmapped (see `NEURODEVELOPMENT_STATUS` in `live_field_map.py`).

`backend/app/ingestion/live_field_map.py`'s `HEALTH_SCREENING_STATUS`/`PHYSICAL_ACTIVITY_STATUS`/`SCREEN_TIME_STATUS` ledgers were updated to `available=True` for the metrics now actually computed (documentation correctness only — no dashboard calculation changed); `NEURODEVELOPMENT_STATUS` stays `available=False` since t43-t51 were never approved.

Frontend: `HealthScreening.tsx`/`PhysicalActivity.tsx`/`ScreenTime.tsx`/`Neurodevelopment.tsx` now render real `KpiCard`/`ChartCard`/`CategoryBarChart`/`HorizontalBarChart` components (reused from Demographics/Overview — no new chart components were built) instead of the old `EmptyStateCard` (deleted, no longer used anywhere). Every KPI shows valid-N/missing-N or "of registered" context; a null mean renders as "—" with an explicit "No data acquired (0/N)" sublabel, never a fabricated 0.

Tests: `backend/tests/test_module_analytics.py` (unit tests for every shared calculation) + service-level tests in `test_live_dashboard_service.py` + endpoint tests in `test_dashboard_endpoints.py`. Verified against **live REDCap data**: all 4 endpoints and their pages checked directly against the live API (e.g. Health & Screening 20/212 completed, 1 Anaemia + 1 Liver case; PAQ-A total score mean 2.47 over 19/212; DSEQ Q10 distribution across 20/212; SSRS Parent 20/212 with data, SSRS Teacher correctly 0/212 with null mean) — all cross-checking exactly against the earlier Excel export audit numbers. Backend: **105/105 tests pass**. Frontend build succeeds; both light and dark theme confirmed via headless-browser screenshots with zero console errors.

---

## FRONTEND ERROR ISOLATION (2026-08-26)

**Bug fixed:** all 4 assessment-module routes (`/health-screening`, `/physical-activity`, `/screen-time`, `/neurodevelopment`) white-screened. **Root cause:** those pages destructure/`.map()` the new analytics response shape with no defensive checks (e.g. `data.named_conditions.map(...)`); if the API ever returns something else — the immediate trigger was a stale local backend process still serving the old pre-refactor `UnavailableModule` shape (`available`/`reason`/`unavailable_fields`) on port 8000 — the resulting `TypeError` had no React error boundary anywhere in the tree, so it unmounted the entire app (sidebar and all), not just the broken route.

**Shared fix** (not four per-page patches): `frontend/src/components/RouteErrorBoundary.tsx` (new) — a class-based React error boundary wrapping `<Outlet />` in `frontend/src/components/Layout.tsx`, keyed by `location.pathname` so navigating to a different route automatically clears any tripped error state. A crash in any routed page now shows a contained "Module Unavailable" card (reuses the existing `StatusBadge` component; no data is invented) while the sidebar/topbar/theme stay intact — verified by forcing a malformed API response via Playwright route interception: the broken route showed the fallback, the sidebar remained visible, and navigating to a healthy route recovered cleanly. This protects all routes present and future, not just the four assessment modules. Page components themselves (`HealthScreening.tsx` etc.) were **not** modified — their live-REDCap logic is unchanged.

Small CSS addition in `app.css`: `.route-error-card` / `.route-error-message` (styled consistently with `.chart-card`).

If a module route ever shows this fallback again in local dev, first check for a stale/zombie backend process holding port 8000 from a previous `uvicorn --reload` session (visible via `Get-CimInstance Win32_Process -Filter "Name = 'python.exe'"` even when `Get-NetTCPConnection`'s reported owning PID doesn't resolve via `Get-Process` — the reload parent can be a different, harder-to-see PID than its multiprocessing worker child) — kill it and restart a fresh backend before assuming a code regression.

---

## LIVE DATA BEHAVIOUR

The backend currently uses an in-memory REDCap cache.

Cache TTL is approximately 30 seconds.

The frontend does not automatically poll.

If implementing a refresh feature:

- explicitly fetch current REDCap data
- do not hardcode values
- show loading state
- show last-updated time

---

## UI DESIGN PRINCIPLES

Current design direction:

- polished React analytics dashboard
- clinical/research aesthetic
- clean cards
- refined typography
- subtle shadows/borders
- restrained colors
- responsive layout
- collapsible sidebar
- light/dark theme may be added later

Avoid:

- Streamlit appearance
- generic admin-template appearance
- excessive giant KPI cards
- excessive navigation
- duplicated charts
- unnecessary gradients
- neon colors
- excessive animation

---

## EXPORT FEATURE — IMPLEMENTED (2026-08-26; CSV format, Excel field-audit expansion, and Excel grouped/analytical refinement all added same day)

**"Export Active Cases"** is implemented on the Participants page as two buttons (Excel + CSV), generated dynamically from live REDCap data (no persistence, no mock data).

Two formats are available: an Excel workbook (3 sheets, for the newsletter) and a flat CSV (single sheet, same approved field set). Both are generated fresh from live REDCap on every request — no caching of the export itself (though the underlying record/metadata fetch still goes through the existing 30s `LiveRedCapRepository` cache).

Backend:
- `backend/app/services/export_service.py` — builds both exports from `RegistryChild` + raw records (already produced by `LiveDashboardService`). No new REDCap fields invented.
- `LiveDashboardService.get_active_cases_export()` (xlsx) and `get_active_cases_csv_export()` (csv) in `backend/app/services/live_dashboard_service.py`.
- Endpoints (both support `?refresh=true` like other endpoints), in `backend/app/api/routes/dashboard.py`:
  - `GET /api/v1/dashboard/export/active-cases` → `.xlsx` bytes, `Content-Disposition: attachment; filename="ICMR_Active_Cases_YYYY-MM-DD.xlsx"`.
  - `GET /api/v1/dashboard/export/active-cases.csv` → UTF-8 (with BOM, for Excel) CSV text, `Content-Disposition: attachment; filename="ICMR_Active_Cases_YYYY-MM-DD.csv"`.
- Dependency added: `openpyxl` (in `requirements.txt`, installed in `.venv`). CSV uses only the stdlib `csv` module.

Excel workbook structure (field-audit expansion 2026-08-26, then refined same day into the current grouped/analytical layout):
- **Sheet 1 — Active Cases**: one row per active child, **103 columns** organized into 10 lettered, merged column groups (row 1) with individual field headers below (row 2) — `A. Registration & Demographics`, `B. SES`, `C. DSEQ`, `D. Child Illness History`, `E. PAQ-A`, `F. Dietary Intake`, `G. SSRS Parent`, `H. SSRS Child`, `I. SSRS Teacher`, `J. Assessment / Progression Status`. Header rows are frozen (`freeze_panes = "A3"`, data starts row 3) and AutoFilter is enabled over the field-header row. Values are real typed data, not strings: dates as `date` objects (`yyyy-mm-dd` format), SES/PAQ-A numeric fields as int/float with number formats (`0`, `#,##0`, `0.00`), categorical fields as REDCap choice labels, blank (`None`) when not collected. Driven end-to-end by one ordered list, `ACTIVE_CASES_FIELD_SPECS` in `export_service.py`, which also generates the Data Dictionary sheet — column set and documentation cannot drift apart.
  - Groups B-F are the field-audit fields (SES raw income + 8 Udai Pareek P2-P9 items, 15 DSEQ items, 34 Child Illness History coded fields, 3 PAQ-A calculated scores, 10 Dietary Intake frequency items) — unchanged from the prior expansion.
  - Groups G/H/I (SSRS Parent/Child/Teacher) now show **real per-child derived summaries** instead of a blanket "not mapped" placeholder: `<Instrument>: Items Answered` (e.g. `"20/52"`), `Avg Frequency Rating`, `Avg Importance Rating` — computed by the export as a simple mean of that child's answered rating items (REDCap codes 0/1/2), explicitly documented as *not* a validated SSRS composite score. Raw per-item fields (92 Parent + 68 Child + 72 Teacher) are fetched (`SSRS_PARENT_FREQ_FIELDS` etc. in `live_field_map.py`, all added to `LIVE_FIELDS`) but not exported as individual columns — this was a user decision (recommended option) over exporting all ~160 raw item columns, to keep the sheet readable. SSRS Teacher's columns use the identical computation (not a special case) and currently show `"0/42"` / blank for every child, since 0 Teacher assessments are complete live — this is a real, dynamically-computed result, not a hardcoded placeholder, and will populate automatically once live Teacher data exists.
  - Group J (new): per-child Complete/Not Complete for Registration + all 8 instruments, plus `Core Assessment Battery` (all six core instruments complete) and `Overall Progression Stage` (highest of Registered/Core Assessment Battery/SSRS Child/SSRS Teacher reached — same cumulative definition as the dashboard's Assessment Progress module, reimplemented locally in `export_service.py` to avoid a circular import, not by modifying that module).
- **Sheet 2 — Assessment Status**: one row per active child — Child ID, Registration, the 8 instrument statuses, **plus new `Core Assessment Battery` and `Overall Progression Stage` columns**. Wording standardized to **"Complete" / "Not Complete"** (previously "Incomplete" — this sheet and Sheet 1's Group J only; the CSV export keeps its original "Complete"/"Incomplete" wording, see below). Complete/Not Complete cells get a light green/neutral fill for at-a-glance scanning. AutoFilter enabled.
- **Sheet 3 — Summary**, retitled **"ICMR Neurodevelopment Study — Active Cases Analysis"**, reorganized into six named sections, each computed dynamically from the exported dataset (never hardcoded): **POPULATION** (active/registered counts, sex/age/village distributions), **SES** (Udai Pareek/BG Prasad category distributions + score summaries, per-capita/raw-income distributions, household-size distribution, the 8 additional Pareek items as tables), **ASSESSMENT ACQUISITION** (instrument-wise completed counts with a real numeric percent column), **ASSESSMENT PROGRESSION** (Registered → Core Battery → SSRS Child → SSRS Teacher counts + stage-to-stage conversion percentages, showing "N/A (no cases reached this stage)" rather than a misleading 0% when a denominator is itself zero), **DOMAIN ANALYSIS** (DSEQ/Child Illness History/PAQ-A/Dietary/SSRS summaries, only computed where real data exists), **DATA COVERAGE** (every instrument bucketed into High/Partial/No-Data-Acquired coverage tiers by its live completion percentage — makes low-coverage instruments immediately visible rather than buried in a long list). All count/percent pairs use real numeric cells with a `0.0%` number format (not formatted strings) so they chart correctly. **14 embedded native bar charts**, all referencing live `'Summary'!` cell ranges (verified, e.g. `'Summary'!$B$56:$B$57`), consistent sizing (8×16, gap width 60, value data labels, no legend clutter), skipped automatically when a table's total is zero. The village chart was changed from Top-15 to a readable **Top-10**, with the full ranked list of all villages kept in the table above it.
- **Sheet 4 — Data Dictionary**: columns renamed to match the requested schema exactly — **Export Column, REDCap Variable, Instrument, Description, Data Type, Acquired vs Derived, Missing-Data Interpretation** — documents every Active Cases column (including the new Group J and SSRS derived columns) plus the Assessment Status columns and an "intentionally excluded fields" list (caste/caste-category, `parent_child_id`/`teacher_child_id`, all free-text `*_spec`/`*_comment`/`*_reason`/`*_remarks` fields, the misleadingly-named `parent_complete`/`teacher_complete` descriptive fields, and now also the 232 raw SSRS rating items that are aggregated rather than exported one-per-column).

**Refinement history**:
- **2026-08-26, field-audit expansion**: added real SES/DSEQ/Child-Illness-History/PAQ-A/Dietary-Intake fields per a live-metadata audit (documented in-conversation, not a repo file). SSRS stayed completion-only at this stage.
- **2026-08-26, same day, refinement pass**: regrouped all Active Cases columns into the 10 lettered sections above, added SSRS Parent/Child real per-child derived summaries (user chose "derived average" over "all raw items" or "frequency-only raw items" when asked, to keep the sheet readable and avoid presenting a naive mean as a validated clinical score), added the Group J progression columns, retitled and restructured the Summary sheet into the 6 named sections, added the Data Coverage section, improved chart consistency/count (13→14, Top-15→Top-10 villages), and expanded the Data Dictionary schema. The CSV export and the Active Case definition were explicitly **not** changed in either pass.
- **Known quirk, not fixed** (shared/existing logic, out of scope to change): `app/ingestion/choice_maps.py`'s bilingual-label stripping splits a choice label on the *first* `/`, which truncates any English choice text that itself contains a mid-word slash — e.g. live DSEQ's "1-2 days/week" resolves to "1-2 days". Affects any such field, dashboard or export; documented in a test comment rather than patched.

CSV structure (`build_active_cases_csv` in `export_service.py`): one flat file, one row per active child. Same demographics/SES columns as the workbook's Sheet 1, followed by a `<Instrument> Status` column (Complete/Incomplete) for all 8 non-registration instruments instead of a separate status sheet. Unlike the workbook, unmapped-instrument values are left **blank** (not the "Not available" placeholder text) per this feature's explicit spec. Exact header order is asserted in `test_csv_header_matches_approved_field_set`.

Active-case definition (shared by both export formats): see "ACTIVE CASE DEFINITION" section above (confirmed with user 2026-08-26; re-confirmed unchanged when the CSV export was added).

Frontend (`frontend/src/routes/Registry.tsx`), two buttons side by side in the same `.export-bar` above the filter bar, each with independent loading/success/error state:
- "Export Active Cases (Excel)" → `exportActiveCases()`.
- "Export Active Cases (CSV)" → `exportActiveCasesCsv()`.
- `frontend/src/api/client.ts` — `apiDownload()` blob-download helper (existing `apiGet` is JSON-only), reused by both buttons.
- `frontend/src/api/dashboard.ts` — `exportActiveCases()` and `exportActiveCasesCsv()`.
- Styles in `frontend/src/styles/app.css`: `.export-bar`, `.export-button` (mirrors `.refresh-button`), `.export-success-text`.

Tests: `backend/tests/test_export_service.py` (workbook structure + CSV structure/header/blank-vs-placeholder behavior/active-case filtering) + endpoint tests for both formats in `backend/tests/test_dashboard_endpoints.py`.

Verified against **live REDCap data** (not just fixtures) on 2026-08-26: backend on port 8000, frontend dev server on port 5173, CSV button clicked via a Playwright-driven headless browser at `/registry` — downloaded `ICMR_Active_Cases_2026-08-26.csv` (213 lines = header + 212 active children, matching the live registered count), correct headers, real child IDs/villages/SES values, blanks where not collected, zero `Dead`-status rows, zero browser console errors, success message rendered.

Re-verified against **live REDCap data** after the field-audit expansion (2026-08-26): fetched a fresh `.xlsx` directly from `/api/v1/dashboard/export/active-cases?refresh=true` and inspected it with openpyxl — 4 sheets, 87-column Active Cases sheet with no caste/free-text/redundant-identifier columns present, real values (e.g. household size, income, DSEQ/CHH/PAQ-A/dietary responses) on children with those instruments complete and correctly blank on children without, 13 charts all referencing live `Summary!` cell ranges, Summary counts cross-checking against known live figures (Core Assessment Battery 20, SSRS Child 4, SSRS Teacher 0 — consistent with the CURRENT LIVE DATA OBSERVATION section above), Data Dictionary sheet documenting all 87 columns plus the exclusion list. No stale/hardcoded literals (`2157`, `172`, `122`, `70`, `67`) present in the changed files.

Re-verified again against **live REDCap data** after the refinement pass (2026-08-26): fetched another fresh `.xlsx` (now 103 columns, 4 sheets). Confirmed: grouped header row + frozen panes (`A3`) + AutoFilter all present; real SES/DSEQ/CHH/PAQ-A/Dietary values typed correctly (dates as `datetime`, income/scores as numbers with the right number formats); **SSRS Parent real averages present** for the ~20 live children with data (e.g. Avg Frequency Rating 0.88, 1.17, ...) and **SSRS Child real averages present** for children with Child data, both varying child-to-child (not invented); **SSRS Teacher confirmed 0/42 items answered and blank averages for every one of the 212 active children** (0 live Teacher completions); Group J progression columns correct (e.g. a child with 5/6 core instruments complete correctly shows `Core Assessment Battery = Not Complete`, `Overall Progression Stage = Registered`; a child with SSRS Teacher complete shows stage `SSRS Teacher`); Summary sheet's 6 named sections all present with real dynamic counts, percent cells confirmed to carry the `0.0%` number format (not text); 14 charts, all referencing live `'Summary'!` ranges (spot-checked, e.g. `'Summary'!$B$56:$B$57`); Data Dictionary's 7-column schema matches the request exactly. No stale/hardcoded literals reintroduced (one `70` match was a column-width constant, not a participant count). Backend: **82/82 tests pass**. Frontend `npm run build` succeeds (no frontend changes were needed for this refinement).

---

## EXISTING VERIFICATION HISTORY

The application has previously been verified with:

- live REDCap connection
- FastAPI endpoints
- React frontend
- browser rendering
- backend tests
- frontend build

Backend test count: **121/121 passing** (as of the 2026-09-03 senior-requirements audit + implementation — see that section above). Frontend `npm run build` succeeds.

Do not assume this remains true after changes — run the tests.

---

## WHEN STARTING A NEW CLAUDE CODE SESSION

DO NOT immediately rewrite or redesign the project.

First read this CLAUDE.md.

Then inspect only the files relevant to the user's current instruction.

Do NOT perform a full repository reconstruction unless explicitly requested.

Do NOT modify files merely because you discover something that could be improved.

For every new task:

1. Understand the request.
2. Inspect the relevant existing implementation.
3. Make the smallest appropriate change.
4. Preserve existing working functionality.
5. Run relevant tests/build.
6. Report exactly what changed.

---

## CURRENT WORKING PRINCIPLE

The user prefers:

- concise implementation prompts
- incremental changes
- no unnecessary architecture changes
- no hardcoded data
- live REDCap data
- visual inspection after UI changes
- short reports after implementation

Do not over-engineer.

Do not rebuild working components unnecessarily.

When uncertain about a business definition, STOP and ask rather than guessing.

## CLAUDE.md MAINTENANCE RULE

CLAUDE.md is the living source of project context for future Claude Code sessions.

After ANY meaningful code or functionality change, update CLAUDE.md so it remains synchronized with the actual project.

This applies to both:

### MINOR CHANGES
Examples:
- UI component changes
- styling changes
- new filters
- renamed routes/components
- small API changes
- bug fixes
- dependency changes
- new tests
- changed cache behavior

### MAJOR CHANGES
Examples:
- new dashboard modules
- new REDCap instruments/mappings
- architecture changes
- new API endpoints
- new export functionality
- new authentication/security behavior
- changes to data aggregation logic
- major frontend restructuring

### AFTER EVERY CHANGE

1. Implement the requested change.
2. Run the relevant tests/build/verification.
3. Inspect the actual resulting code.
4. Update CLAUDE.md ONLY with information that has actually changed.
5. Keep existing accurate project context.
6. Remove obsolete information.
7. Never record temporary/debug information.
8. Never record secrets, API tokens, passwords, or `.env` values.

### IMPORTANT

Do not rewrite CLAUDE.md from scratch after every change.

Make a targeted update so the file remains concise and accurate.

Before starting a new task, read CLAUDE.md.

After completing a task, ask:

"Did this change alter the project's architecture, data flow, available functionality, UI structure, mappings, dependencies, testing status, or important implementation rules?"

If YES:
→ update the relevant CLAUDE.md section.

If NO:
→ do not unnecessarily modify CLAUDE.md.

CLAUDE.md must always describe the CURRENT state of the project, not historical states.

When a previous implementation is removed or replaced, update CLAUDE.md accordingly so future sessions do not attempt to restore obsolete behavior.

---

## SOURCE-OF-TRUTH RULE

Never trust an old statement in CLAUDE.md over the actual code.

If CLAUDE.md conflicts with the current implementation:

1. Inspect the actual code.
2. Treat the current working code as authoritative.
3. Correct CLAUDE.md.
4. Continue from the corrected state.

CLAUDE.md is project memory, not a substitute for inspecting relevant code.
