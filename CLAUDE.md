# ICMR Neurodevelopment Dashboard - Project Context

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

## DEPLOYMENT (Render) - PREPARED 2026-09-01, NOT YET DEPLOYED

`render.yaml` (repo root) defines two Render services matching the existing
architecture exactly - no database service, no new backend logic:

- **`icmr-dashboard-backend`** - Web Service, `env: python`, `rootDir: backend`.
  Build: `pip install -r requirements.txt`. Start:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (existing entrypoint,
  unmodified). Env vars `REDCAP_API_URL`, `REDCAP_API_TOKEN`,
  `CORS_ALLOW_ORIGINS` are `sync: false` (must be entered manually in the
  Render dashboard - never committed); `ENVIRONMENT=production` and
  `LOG_LEVEL=INFO` are set inline (non-secret).
- **`icmr-dashboard-frontend`** - Static Site, `env: static`,
  `rootDir: frontend`. Build: `npm install && npm run build`. Publish:
  `./dist`. Env var `VITE_API_BASE_URL` (`sync: false`, manual) must be set to
  `https://<backend-service>.onrender.com/api/v1`. A catch-all rewrite
  (`/* -> /index.html`) is configured so direct navigation/refresh on any
  client-side route (e.g. `/registry`, `/health-screening`) doesn't 404 - 
  required because `frontend/src/main.tsx` uses React Router's `BrowserRouter`.

No application code changed to support this - `frontend/src/api/client.ts`
already reads `import.meta.env.VITE_API_BASE_URL` (falling back to
`http://localhost:8000/api/v1` only for local dev, never committed as a prod
value), and `backend/app/config.py` already supports multiple comma-separated
CORS origins via `CORS_ALLOW_ORIGINS`, so both localhost and the deployed
Render frontend URL can be allowed simultaneously.

`backend/.env.example` was cleaned up: removed a stale, unused
`DATABASE_URL` line left over from the pre-REDCap V1 scaffold (never read by
any current code - `app/config.py` has no such field); this was a
documentation fix only, not a behavior change. `README.md` was also
corrected to match this section (it previously described the obsolete
PostgreSQL-based V1 architecture).

Actual current routes (for reference - task briefs sometimes list slightly
different paths): `/`, `/registry`, `/demographics`, `/health-screening`
(page title "Child Illness History" since 2026-09-03 - route/path unchanged),
`/physical-activity`, `/screen-time`, `/dietary-intake` (new 2026-09-03),
`/assessments` (new 2026-09-03 - now the grouped instrument-catalogue hub),
`/neurodevelopment`, `/progress` (2026-09-03: removed from all nav menus,
still a working route reachable only by direct URL) - all under
`frontend/src/App.tsx`.

Verified before this config was written (2026-09-01): backend 105/105 tests
pass; frontend `npm run build` succeeds; a temporary local backend instance
confirmed live REDCap data on `/health`, `/overview`, `/registry`, all four
assessment-module endpoints, and both export endpoints (200 OK, real live
counts e.g. core assessment battery 32/212 at time of check - expected to
keep changing as REDCap data grows). No `.env` files are tracked in git
(confirmed via `git ls-files`); only `.env.example` is tracked.

Deployment itself (clicking deploy, entering secrets into Render) was
intentionally NOT performed - prepared for manual review/execution by the
user.

---

## CORRECT REDCAP PROJECT

Project:
ICMR Neurodevelopment Study

Project ID:
196

The application must use whatever REDCAP_API_URL and REDCAP_API_TOKEN are configured to access this project.

DO NOT hardcode PID 196 into business logic. (It appears only in code comments/docstrings as documentation of what was verified against live metadata - never in a conditional or as a request parameter.)

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

Field-level content is mapped into the **dashboard modules** (Overview/Registry/Demographics/Progress) for **Registration** and **SES** only - the other 6 instruments still show only completion status there. Separately, the **Active Cases Excel export** (see EXPORT FEATURE below) additionally reads real acquired/derived field-level data from **DSEQ, Child Illness History, PAQ-A, and Dietary Intake** (approved per the 2026-08-26 field audit) - this is export-only and does not change any dashboard module or calculation. SSRS Parent/Child/Teacher remain completion-status-only everywhere (dashboard and export) - their item-level data is mostly empty in the live project today and was not approved for export. See `backend/app/ingestion/live_field_map.py` for the dashboard field-availability ledger and `backend/app/services/export_service.py`'s `ACTIVE_CASES_FIELD_SPECS` for the export's field-by-field documentation.

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
Core REDCap Instruments Completed (formerly "Core Assessment Battery" internally, "Completed Assessment Set" in the UI - see 2026-09-03 REVISION section): 33
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

This is the only status-like field in the live project - there is no multi-state "active/withdrawn/lost-to-follow-up" field. Confirmed with the user 2026-08-26. Implemented in `backend/app/services/export_service.py` (`_is_active`).

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

## 2026-09-03 REVISION - SENIOR REQUIREMENTS AUDIT + IMPLEMENTATION

A full audit (against live REDCap metadata/data, read-only) was run against a
senior stakeholder's requested revisions, then implemented. Backend
**121/121** tests pass (up from 105 - new tests cover the additions below);
frontend `tsc --noEmit` and `npm run build` both succeed. Verified live
against REDCap (212 registered) after implementation.

**Age**: replaced the old 0-4/5-9/10-14/15+ bands everywhere (Overview,
Demographics, the Demographics age filter) with study-specific exact-year
groups - "8 years" / "9 years" / "10 years" / "Other (outside 8-10 years)"
(only shown if non-zero) / "Unknown" (only shown if non-zero). Source is
still `child_dob` via the existing `compute_age_years`; the reference date
is unchanged ("as of today") since no REDCap metadata establishes a
different convention - this is now a single named constant
(`_AGE_REFERENCE_DATE` in `live_dashboard_service.py`) so it can be changed
to e.g. each child's `visit_date` later without touching bucket logic. This
remains a **flagged clarification item** - not resolved by this change.

**SES category labels**: Udai Pareek (`scr_pareek_category`) and BG Prasad
(`scr_prasad_category`) are REDCap `calc` fields, so the API never returns a
choice list for them - but both fields' own `field_note` text documents
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
`_ordered_labeled_category_distribution()` helper. No label is invented - 
a field_note that doesn't match the pattern yields no entry and the raw
code is shown unchanged (same fallback behavior as any other choice field).

**Overview - Child Illness History + DSEQ**: `OverviewResponse` gained
`chh_completion`/`chh_named_conditions`/`chh_general_flags` and
`dseq_completion`/`dseq_screen_time_distribution`, built by reusing the
existing `build_health_screening_analysis()`/`build_screen_time_analysis()`
 - no parallel calculation engine. Overview now renders two compact tables
("Reported Health Conditions, n (%)" / "Reported Health and
Medical-History Indicators, n (%)") and a "Distribution of Total Daily
Screen Time" chart, positioned between Study Progress and Data Collection
& Quality Status.

**Named/general CHH indicators - denominator model rewrite**: each item in
`named_conditions`/`general_flags` (`HealthScreeningResponse` and the new
Overview fields) changed from a bare Yes-count (`CategoryCount`) to a full
`ConditionIndicator`: `yes_count`, `no_count`, `dont_know_count`
(surfaced as its own bucket wherever a field's REDCap choices actually
include a "don't know"-shaped option - never inferred for fields that don't
offer it), `valid_n` (children who answered THIS question - the correct
percentage denominator), `asked_n` (children who completed the CHH
instrument - kept as a separate, non-substituted denominator), and
`missing_count` (`asked_n - valid_n`). `percent_yes` is `yes_count /
valid_n`, never `/ asked_n` or `/ total_registered`. New helpers:
`response_breakdown()`, `build_condition_indicator()` in
`module_analytics.py`.

**DSEQ ordinal ordering fix**: `module_analytics.py` gained
`ordered_category_counts()`, which orders a field's categories by REDCap
choice-code order (ascending) instead of `category_counts()`'s
descending-frequency sort, and includes every defined category at zero
count so the full ordinal scale is always visible. `q10_total_screen_time`
(DSEQ Screen Time page and the new Overview DSEQ section) now uses this - 
confirmed live: `<30min(8) → 30min-1h(12) → 1-2h(13) → 2-4h(1) → >4h(0)`,
correctly ascending instead of the old descending-by-count order. The
Active Cases Excel/CSV export's own Summary-sheet chart for this field is
**unchanged** (still frequency-sorted via `category_counts()`) - out of
scope, same precedent as the export's frozen "Core Assessment Battery"
wording.

**Dietary Intake dashboard (new)**: previously export-only. New
`build_dietary_analysis()` in `module_analytics.py` (reuses the existing
`DIETARY_LABELS`/`ordered_category_counts`), new `DietaryFoodItem`/
`DietaryIntakeResponse` schemas, new `LiveDashboardService.get_dietary_intake()`,
new `GET /api/v1/dashboard/dietary-intake` endpoint, new
`frontend/src/routes/DietaryIntake.tsx` page (route `/dietary-intake`) - one
compact chart per food group with n/N/% and category order preserved.

**Dietary Intake chart layout fix (2026-09-08)**: the 10 food-group charts
originally used `CategoryBarChart` (vertical bars, category labels along
the x-axis), which visibly overlapped/collided once the live REDCap
`die_*_freq` choice labels turned out to be long (and, per the "Known data
characteristic" note above, Hindi-only with no short English segment to
fall back on). Fixed by switching `DietaryIntake.tsx` to
`HorizontalBarChart` (labels on the y-axis, read normally, no rotation
needed) - the same shared component already used for the SES charts on
Overview/Demographics, not a new one-off chart. `HorizontalBarChart.tsx`
itself gained two capabilities, usable by any future caller, not just this
page: (1) an optional `labelWidth` prop (default `124`, unchanged for
existing callers) controlling the y-axis category column width, and (2) a
custom Y-axis tick (`makeCategoryTick`) that word-wraps a label to fit that
width using the new `wrapLabel()` helper in `chartHelpers.ts` (greedy
word-wrap; hard-splits a single overlong word instead of ever truncating),
replacing recharts' default single-line tick that let long text overflow
past the reserved axis width into the bars - which was the actual root
cause of the collision, not a sizing/margin issue. Row height scales with
however many lines the widest label in a dataset needs
(`DEFAULT_ROW_HEIGHT` 44px + 16px per extra wrapped line), so short labels
(e.g. Udai Pareek's "Upper-middle") still render identically to before -
this is backward-compatible for every other `HorizontalBarChart` caller.
New exported `computeHorizontalBarChartHeight(datasets, labelWidth)`
computes one shared height across *all* of a group's datasets at once (not
each chart sizing itself independently); `DietaryIntake.tsx` calls this
once for all 10 food items and passes the same `height` + `labelWidth`
(`FOOD_GROUP_LABEL_WIDTH = 190`) to every chart, so all 10 charts in
"Consumption Frequency by Food Group" share identical dimensions and
y-axis alignment. No REDCap field, calculation, denominator, category
ordering, or API response changed - `CategoryBarChart.tsx` is untouched
and still used as-is by Overview/PhysicalActivity/ScreenTime/Demographics.
Frontend `tsc --noEmit` and `npm run build` both succeed; no backend files
touched.

**"Completed Assessment Set" → "Core REDCap Instruments Completed"**: this
UI label (Overview KPI card, Overview footnote, Assessment Progress funnel
stage + instrument-table title) is renamed again - the six-instrument
intersection is a genuine, justified dashboard-level grouping (it gates the
SSRS Child/Teacher funnel stages), so this name honestly describes what it
measures without implying a validated clinical milestone. Internal
identifiers (`core_assessment_count`, stage key `core_assessment_battery`,
`CORE_BATTERY_*` constants) are unchanged. The Excel/CSV export still says
"Core Assessment Battery" - unchanged, out of scope (same established
precedent as the prior rename).

**Terminology renames applied** (dashboard UI only - the Active Cases
Excel/CSV export's own headers/chart titles are deliberately unchanged,
same precedent as above):
- "Health & Screening" → "Child Illness History" (page title, nav item;
  route `/health-screening` and the API path `/dashboard/health` are
  unchanged - only user-facing text moved).
- "Average Total Daily Screen Time" → "Distribution of Total Daily Screen
  Time" (Screen Time page section + chart title; also used on the new
  Overview DSEQ section).
- Module-status badges (Health & Screening / Screen Time / Physical
  Activity / Dietary Intake pages) changed from an ambiguous `"{tier}
  coverage"` badge (e.g. "Partial coverage") to `"Instrument Completion:
  n/N (%)"`.
- PhysicalActivity.tsx's invented subtitle gloss "Physical Activity
  Questionnaire for Adolescents" (not present anywhere in REDCap metadata - 
  the live REDCap instrument label is literally "PAQ A") was removed and
  replaced with a neutral, metadata-accurate subtitle. No UI claim was
  added resolving whether PAQ-A or PAQ-C is the more age-appropriate
  version for this ~9-10-year-old cohort - that remains an open
  confirmation item for the study team, not a code decision.

**Assessment instrument structure**: `frontend/src/routes/AssessmentsHub.tsx`
(route `/assessments`) is the authoritative instrument catalogue - "Explore
each study instrument and its current data availability." Instruments are
grouped into 5 sections matching established study terminology: **Core /
Baseline** (Baseline/Participant Information, SES), **Health & Behaviour**
(Child Illness History, DSEQ, PAQ, Dietary Intake), **Social Functioning**
(SSRS Parent/Child/Teacher), **Cognitive / Developmental** (ASER, SANGIAN,
Visual Working Memory, DCCS, Colour Detection Task), **Anthropometry**
(Anthropometry/BIA). The 9 real instruments render as compact cards
(icon, name, one-line purpose, a derived status - "Completed" if
completed_count equals total_registered, "Data Available" if >0, else "No
Data Available" - plus `n/N (%)` and a thin proportion bar) built entirely
from the existing `/dashboard/overview` response's `all_instrument_coverage`
 - no new backend endpoint or field was added for this page. The 6
placeholder instruments render identically in card shape but as a button
showing only "Under Development"; clicking expands an inline panel reading
"Under Development / Data for this assessment is not currently available in
the dashboard" - no route navigation, no API call, no fake numbers. This
remains a UI/product-status representation only, not evidence any of the
six exist in REDCap.

**Navigation simplification (2026-09-03, third pass)**: the standalone
"Progress" primary nav item was removed - study progress is already
communicated via Overview's Study Snapshot + Assessment Coverage, and the
per-instrument completion now visible on the Assessments hub. The
`/progress` route/`AssessmentProgress.tsx` page and its
`GET /dashboard/progress` endpoint are **unchanged and still reachable by
direct URL** - same precedent as Neurodevelopment being nav-hidden-but-not-
deleted.

**Navigation simplification (2026-09-03, fourth pass - dropdown removed)**:
the "Assessments" topnav item is no longer a dropdown at all - top
navigation is now exactly **Overview | Registry | Assessments**, each a
plain link (`frontend/src/components/Layout.tsx`; the `QUICK_NAV` array and
outside-click dropdown state/logic from the third pass were removed, not
just hidden, since the hub page now fully replaces that role). Clicking
"Assessments" goes straight to the `/assessments` hub, which is the single
authoritative instrument catalogue. A `ASSESSMENT_ROUTES` list still keeps
the "Assessments" nav item visually active while browsing any individual
assessment page (Child Illness History, Screen Time, Physical Activity,
Dietary Intake, Neurodevelopment), computed manually against
`location.pathname` since a plain `NavLink` would otherwise only match
`/assessments` exactly.

**Overview cleanup (2026-09-03, fourth pass)**: the "Study Progress" funnel
card was removed from Overview entirely (it duplicated the Assessment
Coverage table's per-instrument numbers and the Snapshot's headline counts;
the dedicated `/progress` page - still reachable by direct URL - keeps the
full funnel view). Study Profile's three charts were rebalanced: Sex
Distribution and Age Distribution now share a `two-col` row (donut height
168, age chart height 190 - more compact, matching "balanced, not
oversized"), and SES Category (Udai Pareek) was moved to its own full-width
card below rather than squeezed into a three-column row, since its
descriptive category labels ("Upper-middle", "Lower-middle") and
end-of-bar "n (%)" labels need more horizontal room than a one-third
column reliably provides.

**Shared chart layout fix**: `frontend/src/components/HorizontalBarChart.tsx`'s
right margin was increased from 46px to 68px - the fix lives in the shared
component (used by Overview's and Demographics' SES charts alike), not as
a one-off page-level patch. The previous 46px margin was tight enough that
the trailing `"n (%)"` end-of-bar label (e.g. `"34 (16.0%)"`) could clip
against the chart's right edge, especially in a narrower column; this was
the root cause of the "squeezed" SES chart, not a ResponsiveContainer or
grid sizing defect.

**Known data characteristic (not a bug, flagged for the study team)**: the
10 Dietary Intake frequency fields' (`die_*_freq`) REDCap choice labels are
**Hindi-only** (no English segment at all, confirmed live 2026-09-03 - 
unlike most other bilingual fields in this project, which are "English
/Hindi"). `choice_maps.py`'s English-segment extraction has nothing English
to extract for these, so the Dietary Intake page currently displays these
category labels in Hindi, exactly as REDCap defines them - no English
label was invented. This needs a study-team decision (translate on the
REDCap form, or accept Hindi-only category labels on this one page).

---

## FRONTEND STRUCTURE

**Navigation redesign (2026-09-01, two passes):** the persistent left
sidebar was replaced with a **top navigation bar**
(`frontend/src/components/Layout.tsx`, rewritten; the collapsible-sidebar
mechanic and its ~270 lines of CSS were removed, not preserved as dead
code). A same-day follow-up pass restructured it into two stacked rows - 
brand identity on top, nav centered below - and trimmed the nav items:

```
ICMR Neurodevelopment Study Dashboard
     [ Overview | Registry | Assessments ▾ | Progress ]
```

*(superseded 2026-09-03, fourth pass - see "Navigation simplification" above:
the nav is now exactly `Overview | Registry | Assessments`, no dropdown, no
Progress item. The description below is kept for history/provenance.)*

- Row 1 (`.topnav-header-row`): brand mark/title (left), live-REDCap badge
  (right on desktop), mobile menu button (right, mobile only).
- Row 2 (`.topnav-links`): centered nav - Overview, Registry, Assessments
  dropdown, Progress. **"Exports" was removed as a separate nav item** - it
  pointed at the same `/registry` route as "Registry" already does, so it
  was redundant; there is still no separate exports page/route, and the
  Export Active Cases (Excel/CSV) buttons still live only on the Registry
  page, unchanged.
- "Assessments" is a click-toggle dropdown (closes on outside click, on
  navigation) listing **3** modules: Health & Screening, Physical Activity,
  Screen Time. **Neurodevelopment was deliberately removed from this nav
  list** (information-architecture decision only) - its route
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
`.topnav-header-row` itself, next to the brand and live badge - one
cohesive branded header instead of a page-content bar that felt like a
separate application shell. `Topbar.tsx`'s internal logic is unchanged
(still reads `useRefresh`/`useTheme` the same way); only where it renders
moved, plus its refresh-button label text was wrapped in a
`.refresh-button-label` span (structural only, no behavior change) so it
can be hidden below 900px - at that width the header keeps the refresh and
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

- `frontend/src/components/StudyDataLoader.tsx` - a compact "study data /
  neural network" loader: an inline SVG hexagon-ring of 6 nodes with a
  looping dash animation tracing the ring (`.study-loader-flow`) and nodes
  that pulse in sequence (staggered `animation-delay`), plus "Loading study
  data" / "Connecting to live REDCap data…" / "Preparing dashboard" text
  (all overridable via props). Occupies only its own vertical space - no
  full-screen takeover. All animation is CSS-only, wrapped in
  `@media (prefers-reduced-motion: no-preference)`, so a reduced-motion
  preference yields a fully static hexagon instead of no loader at all.
  Animation duration is fixed regardless of how long the request takes - 
  deliberately does not escalate/intensify on a slow request.
- `frontend/src/components/DataLoadError.tsx` - the error state, now with a
  **Retry** button (reuses the existing `.refresh-button` style) that
  re-triggers that page's own fetch via a local `retryCount` state included
  in the page's `useEffect` dependency array. This does not call the
  global "Refresh data" REDCap-cache-busting action - it's a plain re-fetch
  of the same (possibly still-cached) data, appropriate for recovering from
  a transient network/request failure.

Old `.loading-text` CSS rule was removed (no longer referenced anywhere).
No REDCap API logic, dashboard calculations, or routes were touched - this
is purely a loading/error UI change, reused identically across all 8 pages
that fetch live data. Verified: frontend `tsc --noEmit` and `npm run build`
both succeed; a temporary local backend + `vite preview` of the production
build served the app with 200 OK and valid HTML. `StudyDataLoader` /
`DataLoadError` were already in place from this pass - a later refinement
pass (same day) reused them unchanged; no loader rework was needed.

**Content trim for senior-facing readability (2026-09-01, same day):**
removed long implementation/governance-note paragraphs that were rendering
directly in the UI - e.g. Health & Screening's/Screen Time's
`data.notes.scope`, Physical Activity's `data.notes.scores`,
Neurodevelopment's `data.notes.scope`/`data.notes.ssrs_teacher` (dated
approval notes, Excel-export cross-references, field-availability caveats).
The underlying `notes` fields **still exist unchanged in the API
responses** (`backend/app/schemas/dashboard.py`) - only the frontend
`<p className="chart-card-note">{data.notes.x}</p>` lines that rendered
them were removed from `HealthScreening.tsx`, `PhysicalActivity.tsx`,
`ScreenTime.tsx`, `Neurodevelopment.tsx`. Also replaced the raw
full-precision score-range sublabel (e.g. "n=31/212 acquired (14.6%) ·
range 1.1111111111111112–1.5555555555555556") with a concise
"31 participants · 14.6% coverage" in `PhysicalActivity.tsx`'s and
`Neurodevelopment.tsx`'s local `scoreSublabel()` helpers - `percent_valid`
was already rounded server-side; only the unrounded `minimum`/`maximum`
range clause was dropped from display (those raw values are still in the
API response for anyone who needs them, just not shown on this page).
`SectionHeader`/`ChartCard` note props with genuinely interpretive text
(e.g. "DSEQ Q10, among children who completed the instrument") were kept - 
only internal-process/documentation-style paragraphs were removed.
Demographics' short per-chart notes (e.g. explaining Udai Pareek/BG Prasad
are numeric category codes) were left as-is - same day, out of scope for
this pass, and short/attached rather than a standalone long paragraph.

---

## PAGE RESPONSIBILITIES

### Overview

Study-level summary.

**Overview final refinement (2026-09-08 - supersedes the KPI list and section
set below):** the Study Snapshot KPI row was trimmed to exactly two cards - 
**Registered** and **Core REDCap Instruments Completed** (sublabel now reads
"X% of registered - current overall assessment coverage"). The standalone
SSRS Parent/Child/Teacher KPI cards were removed from Snapshot - they
duplicated numbers already shown per-instrument in the Assessment Coverage
table (`all_instrument_coverage` includes ssrs_parent/ssrs_child/ssrs_teacher
rows) and in the cumulative funnel on the still-reachable `/progress` page;
no calculation, field, or API response changed, only which KPI cards render.
A new compact `.snapshot-status-row` (reuses the existing `.live-badge` +
`.last-updated` classes) sits directly under the KPI row showing "Live
REDCap data" + "Last updated HH:MM:SS", sourced from the same `useRefresh()`
context Topbar already uses - this duplicates Topbar's badge only on wide
screens (where Topbar's own badge is visible in the header row) and is the
only place that status is visible below the ~900px breakpoint, where
Topbar's live badge and nav hide. The two former standalone sections "Broad
health signal" and "Broad screen-time signal" were merged into one
**"Current data signals"** section, rendered as a `chart-grid two-col` row
(previously two full-width stacked sections) - same underlying data/links,
just presented side by side; the Child Illness History card now shows only
the single top-ranked condition/indicator (`topReportedItems(..., limit=1)`,
was `limit=5` feeding a short list) since the section's job is one
descriptive signal, not a mini-list - full item-level detail is still
exclusively on `/health-screening`. The "Study Progress" funnel section
(already removed from Overview in an earlier 2026-09-03 pass - see the
REVISION section above) was **not** reintroduced. The Data Collection &
Quality Status panel's "Last refresh" stat was dropped (redundant with the
new Snapshot status row) - it now shows 3 stats instead of 4, and
`.status-stat-grid`'s CSS changed from a fixed `repeat(4, 1fr)` to
`repeat(auto-fit, minmax(170px, 1fr))` so the stat count can change without
a matching CSS edit. `DonutChart`'s height on the Sex Distribution chart was
changed from 168 to 190 to match the adjacent Age Distribution bar chart in
the same `two-col` row (both charts' cards stretch to the row's tallest
card via CSS grid default `align-items: stretch`; mismatched internal chart
heights left visible dead space under the shorter one). Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files were
touched, so backend REDCap mappings/calculations/API contracts are
unchanged - verify this is still true by inspecting `git status` before
trusting it in a future session, per the source-of-truth rule.

**Overview correction (2026-09-08, same day - Assessment Coverage restored
as cards, not a table):** the KPI-trim above made Overview feel too sparse
for senior reviewers, who need to see the study's instruments at a glance.
The 9-row Assessment Coverage **table** (added 2026-09-01, see the restore
bullet below) was replaced with a compact **instrument card grid** - the
same visual card used on the Assessments hub (icon, name, one-line purpose,
`StatusBadge`, `n/N (%)`, a thin proportion bar, and a "View assessment →"
affordance linking to that instrument's page). To avoid duplicating this
card's JSX/status-derivation logic across two pages, it was extracted into
a new shared component, `frontend/src/components/InstrumentCoverageCard.tsx`
(exports `InstrumentCoverageCard`, the `AvailableInstrument` type,
`deriveStatus()`, `STATUS_BADGE_TONE`) - `AssessmentsHub.tsx`'s previously
Hub-local `AvailableInstrumentCard`/`deriveStatus`/`STATUS_BADGE_TONE` were
deleted in favor of importing this shared version (`AssessmentsHub.tsx`'s
own behavior/output is otherwise unchanged - same `GROUPS` data, same
groups/placeholders). `AssessmentsHub.tsx`'s `GROUPS` constant is now
`export`ed so Overview can reuse the same instrument metadata
(name/purpose/route/icon) instead of a second hardcoded copy that could
drift out of sync; Overview computes `OVERVIEW_INSTRUMENTS =
GROUPS.flatMap(g => g.available).filter(i => i.key !== "registration")` - 
all 8 currently-mapped instruments (SES, Child Illness History, DSEQ /
Screen Time, PAQ / Physical Activity, Dietary Intake, SSRS - Parent/Child/
Teacher) **except** Registration/Baseline, which is intentionally excluded
since it's already the "Registered" Snapshot KPI card. The 5
Cognitive/Developmental + Anthropometry placeholder ("Under Development")
instruments are **not** shown on Overview - they remain exclusively on the
Assessments hub, per this correction's explicit instruction not to clutter
Overview with unavailable future instruments. These cards are summary/
coverage only (same `n/N (%)` + status as the table they replaced) - they do
**not** reproduce any instrument's detailed charts/tables, which stay
exclusively on that instrument's own assessment page. Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files touched.

**Overview Snapshot restored to 4 headline cards (2026-09-08, same day):**
the KPI row is now **Registered, Core REDCap Instruments Completed, DSEQ /
Screen Time, SSRS** - DSEQ uses `overview.dseq_completion.completed`/
`.percent` (the same `InstrumentCompletion` values already used in Current
Data Signals). **SSRS is one card, not three** - a local component in
`Overview.tsx`, `SsrsSummaryCard`, renders Parent/Child/Teacher as compact
rows inside a single card, fed by the same `ssrs_parent_count`/`_percent`,
`ssrs_child_count`/`_percent`, `ssrs_teacher_count`/`_percent` fields the
original (pre-2026-09-08) 5-KPI Snapshot used - no new field, no
recalculation. A row with `count === 0` renders "No data available"
(currently the Teacher row, live) instead of "0/212 (0%)". This is a
coverage-only glance (n/N/% per stage) - it does not reproduce SSRS
item-level analysis, which stays on `/neurodevelopment`. This supersedes
the "trimmed to exactly two cards" wording earlier in this section's
2026-09-08 note above (that note's other points - merged Current Data
Signals, dropped "Last refresh" stat, `DonutChart` height fix - still
stand unchanged). SSRS Parent/Child/Teacher live counts also remain fully
available in the Assessment Coverage instrument cards and on `/progress`.

**Study Snapshot visual refinement (2026-09-08, third pass - cards only,
no data change):** the 4 headline cards felt generic, so a dedicated
presentation was built for this row only (the shared `KpiCard.tsx` used
elsewhere - Neurodevelopment, Physical Activity, Demographics - was left
untouched, so this refinement can't affect those pages). New
`frontend/src/components/SnapshotMetricCard.tsx` exports
`SnapshotMetricCard` (Registered/Core/DSEQ - label caption on top, a large
tabular-nums value anchored toward the card's bottom via `margin-top: auto`
so every card's footer lines up, and - where applicable - a colored percent
pill using the card's own tone) and `SnapshotCardShell` (the same frame,
used by `SsrsSummaryCard` to hold the custom Parent/Child/Teacher body).
Each tone (`snapshot-tone-blue/aqua/amber/violet`, one per card) now drives
a **solid-color icon chip** (not just the earlier thin top accent strip,
which is kept but is no longer the only differentiator) - CSS in
`app.css`: `.snapshot-card`, `.snapshot-tone-*`, `.snapshot-card-icon`,
`.snapshot-card-label/value/percent/caption`. The SSRS breakdown now reads
as a designed composition, not plain rows: each rater gets an initial chip
(P/C/T), its own `n/N (%)` (or "No data available"), and a mini
`ProportionBar`, separated by hairline dividers (`.snapshot-ssrs-*` CSS,
replacing the flatter `.kpi-ssrs-*` classes from the prior pass, which were
removed as dead CSS). The long "Core REDCap Instruments Completed = SES,
DSEQ, ..." explanatory paragraph below the KPI row was deleted - that
definition is implicit in the per-instrument Assessment Coverage cards
below, and the paragraph read as a stray footnote rather than dashboard
copy. The Live REDCap / last-updated line (`.snapshot-status-row`) was
made visually secondary (smaller badge/text, reduced opacity) so it reads
as fine print under the now much stronger metric cards, not a peer of
them. No metric label text, field, calculation, denominator, or route
changed - this pass is presentation-only. Frontend `tsc --noEmit` and
`npm run build` both succeed; no backend files touched.

**Study Snapshot compacted (2026-09-08, fourth pass - supersedes the
"solid-color icon chip"/pill/bar styling above):** the third pass above
made the 4 cards too tall and visually empty, so the density was corrected
without removing any information. `SnapshotMetricCard` now renders one
compact block: an icon + normal-case title on one line
(`.snapshot-card-head`/`.snapshot-card-title` - no more all-caps label),
the value directly beneath with a small tight gap (`.snapshot-card-value`,
reduced from `2.15rem`/800-weight to `1.55rem`/750-weight - still clearly
the card's focal point, just not oversized), and one plain line of
supporting `n/N (%)` text (`.snapshot-card-support`, replacing the
`.snapshot-card-percent` pill and the separate `.snapshot-card-caption`
slot - `SnapshotMetricCardProps` now takes a single `support?: string`
instead of `percentLabel?`/`caption?`). The Core/DSEQ cards' support line
now reads the full `n/N (%)` (e.g. "33/212 (15.6%)"), not just the
percent, so the denominator stays visible without a second element.
`SsrsSummaryCard`'s rows dropped the per-rater initial chip and the mini
`ProportionBar` - each row is now one label/value line
(`.snapshot-ssrs-row`), matching the plainer density of the other three
cards; the "No data available" muted-italic treatment for a zero-count row
is unchanged. `.snapshot-card`'s fixed `min-height: 172px` and generous
`space-5`/`space-4` padding were removed in favor of tight `space-3`/
`space-4` padding and natural content height - the row's 4 cards still
end up equal height (CSS grid `align-items: stretch` on `.snapshot-row`,
unchanged), just at a much shorter natural height, so Study Profile now
appears noticeably sooner on the page. The left accent strip and icon
tint (`.snapshot-tone-*` - same 4 tones/colors) are kept but subdued: the
icon chip is smaller (22px, soft tone-tinted background instead of a
solid-fill glow) and the left strip is at 70% opacity - accent/identity is
still visibly present, just not decorative. No metric, field, calculation,
denominator, or route changed - presentation-only. Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files touched.

**Above-the-fold header tightened (2026-09-08, fifth pass - Overview
only):** the gap between the page header (eyebrow/title/subtitle) and
Study Snapshot was too generous, reading as a landing-page hero instead of
a dashboard. Overview's root `<section>` now carries a `overview-page`
class, and `app.css` adds scoped overrides right after the shared
`.page-header-subtitle` rule: `.overview-page .page-header` margin-bottom
`space-6` (32px) to `space-4` (16px), `.overview-page .page-header-eyebrow`
margin-bottom 12px to 6px, `.overview-page .page-header-subtitle`
margin-top 8px to 3px, and `.overview-page .section-header:first-of-type`
margin-bottom `space-4` to `space-3`. These are scoped to `.overview-page`
rather than edited on the shared `.page-header`/`.section-header` rules,
so every other route's header spacing is unchanged. Title font-size, all
colors, and the four Snapshot metric cards themselves are untouched - this
is spacing-only. `frontend/src/components/PageHeader.tsx` itself was not
modified. Frontend `tsc --noEmit` and `npm run build` both succeed; no
backend files touched.

**Snapshot status row removed + strip layout (2026-09-08, sixth pass -
supersedes the `.snapshot-status-row` references in the 2026-09-08 notes
above):** the "Live REDCap data" / "Last updated" line added under the
Snapshot cards (originally to cover the ~900px-and-below breakpoint where
Topbar's own badge hides) was judged a duplicate of the global header and
removed outright - that status now lives **only** in the global Topbar/
Layout header, on every breakpoint. `Overview.tsx` no longer destructures
`lastUpdated` from `useRefresh()` (still uses `version` to re-fetch on
refresh) and its local `formatTime()` helper was deleted as dead code.
Separately, the 4 Snapshot cards were restructured from a `kpi-row
snapshot-row` CSS grid of 4 independently-boxed `.snapshot-card` cards into
**one cohesive strip**: a single outer frame (`.snapshot-strip` - one
border/shadow/radius) containing 4 equal-width columns
(`.snapshot-strip-item`, replacing the `.snapshot-card` class on both
`SnapshotMetricCard` and `SnapshotCardShell`) separated by a hairline
`border-left` divider instead of a grid gap. Each column keeps its own
tone identity via a thin 2px **top** accent bar (`.snapshot-strip-item::
before`, replacing the old per-card left-edge bar, which read oddly once
cards shared one frame) - `.snapshot-tone-*`/`.snapshot-card-icon`/
`-title`/`-value`/`-support` class names and values are otherwise
unchanged, so this is a container/wrapper change, not a rewrite of the
card content. Below 760px the strip wraps into a 2x2 grid
(`.snapshot-strip-item { flex: 1 1 50%; }` with `nth-child` border rules)
instead of 4 stacked full-width rows. The gap between the strip and the
next section header ("Study profile") was tightened via
`.overview-page .snapshot-strip + .section-header { margin-top: space-5;
}` (24px, down from the shared `.section-header`'s default 44px), scoped
so it affects only the header that immediately follows the Snapshot strip.
No metric, calculation, denominator, field, or route changed - this pass
is layout/DOM-structure and CSS only. Frontend `tsc --noEmit` and
`npm run build` both succeed; no backend files touched.

**Overview restructure (2026-09-01, second pass - analytical layout):**
below the "Study snapshot" KPI row, the page now has four further
sections, each answering a distinct question (no section repeats another's
numbers in more than one additional format):

- **Study Profile** (new) - three compact charts using `OverviewResponse`
  fields that were already being fetched but not charted on this page:
  `sex_distribution` as a donut (new `frontend/src/components/DonutChart.tsx`
   - thin Recharts `Pie`/`Cell` wrapper matching the existing chart
  components' styling conventions; recharts was already a dependency, no
  new chart library added), `age_distribution` as a bar chart (existing
  `CategoryBarChart`, `mode="sequential"`), and
  `udai_pareek_category_distribution` as a horizontal bar chart (existing
  `HorizontalBarChart`) - the same data Demographics also charts, shown
  here as a compact population snapshot rather than the detailed page.
- **Assessment Coverage** - (superseded 2026-09-08, see the correction note
  above - now an 8-card `InstrumentCoverageCard` grid, not a table) the
  previous 9-row `CoverageBar` panel (9 large progress bars, visually
  repetitive) was replaced with a **compact table** (reuses the existing
  `.table-card`/`table.data-table` styling from the Registry page - no new
  table component) - one row per instrument:
  Assessment Instrument | Completed | Coverage | Status
  (`StatusBadge` for High/Partial/No Data). Still all **nine** live
  instruments from `all_instrument_coverage`, still each independently
  calculated from its own `*_complete` field - only the presentation
  changed, not the data or calculation. The old subtle
  Registration/Study Assessments/Social Skills Assessments row-grouping was
  dropped (a flat table doesn't need it); `CoverageBar.tsx` itself is
  unchanged and still used by the Assessment Progress page's own
  instrument breakdown (see below).
- **Study Progress** - unchanged: the `Funnel` component only (registered →
  Completed Assessment Set → SSRS Child → SSRS Teacher), reusing
  `ProgressResponse.stages`. (An earlier pass had already removed a
  duplicate 4-card `ProgressStageCard` KPI grid from this page - see prior
  entry below; `ProgressStageCard.tsx` remains intentionally unused in the
  codebase, kept pending an explicit dead-code-cleanup decision.)
- **Data Collection & Quality Status** - the compact `.status-stat-grid`
  panel (total instrument-completions collected, count at High coverage,
  count needing attention) plus the Partial/No-Data flag list. The stat grid
  originally also had a fourth "last refresh" stat - removed 2026-09-08 as
  redundant with the new Snapshot status row (see note above).

Do NOT duplicate detailed demographic analysis here.

Do NOT show the large Module Integration Status section on Overview.

Verified (this pass): backend **113/113** tests pass (unchanged - no
backend files were touched); frontend `tsc --noEmit` and `npm run build`
both succeed. Live-checked against REDCap (212 registered): sex 110
male/102 female/0 unknown, age buckets 0/188/24/0 across 0-4/5-9/10-14/15+,
Udai Pareek categories 3→7, 4→24, 5→1 - all read directly from the live
`/api/v1/dashboard/overview` response. The 9-row coverage table's live
values matched exactly: Registration Form 212/100%/High; SES, DSEQ, Child
Illness History, PAQ-A, Dietary Intake, SSRS Parent each 32/15.09%/Partial;
SSRS Child 17/8.02%/Partial; SSRS Teacher 0/0%/No Data.

**Assessment Progress page:** the duplicate 4-KPI-card row above the funnel
(same numbers as Overview's Snapshot) was removed - the page now opens
directly with the funnel, then the "Completed Assessment Set instruments"
6-row breakdown (unchanged calculation, now also shows `coverage_tier`).

**Assessment module pages (Health & Screening / Physical Activity / Screen
Time):** the standalone "Instrument Completion" `KpiCard` was replaced with
a compact `.module-status-line` (a `StatusBadge` + one line of text) above
each page's real analysis, so the page opens into its actual chart(s)
rather than a one-card preamble. Genuinely distinct KPIs on these pages
(PAQ-A's 3 score summaries, Screen Time's 3 yes/no items) are unchanged.
Neurodevelopment was left as-is - its per-instrument "children with any
data" KPI is a different metric, not a literal completion/tier card, so the
"remove the standalone Instrument Completion KPI" change doesn't apply
there.

#### UI TERMINOLOGY (updated 2026-09-03; originally 2026-09-01)

"Core Assessment Battery" is displayed as **"Core REDCap Instruments
Completed"** (renamed 2026-09-03 from the earlier placeholder "Completed
Assessment Set" - see the 2026-09-03 REVISION section above) in all
user-facing text on the Overview KPI cards, the new Overview footnote, and
the Assessment Progress funnel/stage-instrument-breakdown
(`frontend/src/routes/Overview.tsx`, `frontend/src/routes/AssessmentProgress.tsx`,
and the `ProgressStage.label`/`description` strings built in
`backend/app/services/live_dashboard_service.py::get_progress`/`get_overview`).
This name was chosen because the six-instrument intersection genuinely is a
dashboard-level "core instruments" grouping (it gates the SSRS Child/Teacher
funnel stages) - do not propagate it elsewhere without re-confirming (the
Active Cases Excel/CSV export in `export_service.py` intentionally still
says "Core Assessment Battery" - out of scope for this rename, left
unchanged). The underlying calculation
(all six of SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake, SSRS
Parent complete for the same child - `CORE_BATTERY_COMPLETE_FIELDS`) is
**unchanged**; only the display label moved. Backend field/key names
(`core_assessment_count`, `core_assessment_percent`, stage key
`core_assessment_battery`) were deliberately left as-is - internal
identifiers, not user-facing text.

#### API - Overview instrument data (as of 2026-09-01)

`OverviewResponse` (backend/app/schemas/dashboard.py) carries two distinct
per-instrument breakdowns, both `list[InstrumentCoverage]` (`key`, `label`,
`completed_count`, `percent_of_registered`, and - added 2026-09-01 - 
`coverage_tier: "High"|"Partial"|"No Data"`, computed via the
**already-existing** `module_analytics.coverage_tier()` helper, same ≥50%/
>0%/0% thresholds already used by the 4 assessment-module endpoints and the
Excel export's DATA COVERAGE section - no new calculation logic was
introduced, only reuse):

- `instrument_coverage` - the original 6 Completed-Assessment-Set
  instruments only (SES, DSEQ, Child Illness History, PAQ-A, Dietary
  Intake, SSRS Parent). Still used by the Assessment Progress page's
  "Completed Assessment Set instruments" breakdown - unchanged.
- `all_instrument_coverage` - **new**, all 9 live instruments (adds
  Registration Form, SSRS Child, SSRS Teacher), each computed independently
  via `_all_instrument_coverage()` / `ALL_INSTRUMENTS` in
  `live_field_map.py`. Powers the new Overview "Assessment Instrument
  Coverage" panel. SSRS Child/Teacher here are **raw** independent
  completion counts (not gated by Completed-Assessment-Set membership like
  the cumulative `ssrs_child_count`/`ssrs_teacher_count` progression
  fields) - a deliberate difference from the funnel's cumulative logic,
  since this panel answers "how many completed this instrument on its own,"
  not "how many progressed through the pipeline."

`OverviewResponse` also still carries the standalone `ssrs_parent_count`/
`ssrs_parent_percent` fields (added same rename effort) - independently
computed from `ssrs_parent_complete`, not derived from the Completed
Assessment Set. No longer shown as its own top-level KPI card (see above);
its value is also the `ssrs_parent` row in `all_instrument_coverage`. Both
are computed from the same `_unique_ids_with_complete_field(records,
SSRS_PARENT_COMPLETE_FIELD)` call, so they can never diverge.

Verified: backend **113/113** tests pass, including
`test_overview_all_instrument_coverage_includes_all_nine_instruments`,
`test_overview_all_instrument_coverage_counts_are_independent` (uses fixture
record REC004 - `ssrs_parent_complete="2"` but incomplete Dietary Intake - 
to prove per-instrument counts never collapse into the Completed Assessment
Set aggregate), a zero-completion percent-formula check, and (2026-09-01)
`test_overview_all_instrument_coverage_includes_coverage_tier` +
`test_overview_instrument_coverage_includes_coverage_tier`. Frontend
`tsc --noEmit` and `npm run build` both succeed. Live-checked against
REDCap (212 registered at time of check): Registration Form 212/100%/High,
SES/DSEQ/Child Illness History/PAQ-A/Dietary Intake/SSRS Parent each
32/15.09%/Partial, SSRS Child 17/8.02%/Partial, SSRS Teacher 0/0%/No Data - 
all read directly from the live `/api/v1/dashboard/overview` response, not
asserted from memory. All 8 routes, both export formats (xlsx/csv), and
every dashboard endpoint re-checked with 200 OK against a live local
backend after the navigation/Overview redesign.

### Participants (Registry) - redesigned 2026-09-09 as a study-operations panel

`frontend/src/routes/Registry.tsx` is a **find -> filter -> understand -> act**
operational tool, deliberately distinct from Overview - no cohort KPIs/study
profile/coverage charts are duplicated here.

**Quick Queries** (`Study Operations` panel above the table) - actionable
filters, not KPI cards:
- **Assessment Follow-up** - children who cleared the Core Assessment Battery
  gate but haven't yet cleared SSRS Teacher (`progression_stage` in
  `{Core Assessment Battery, SSRS Child}`) - i.e. eligible/pending for their
  next pipeline stage. Same cumulative definition as the Assessment Progress
  funnel; no clinical/date rule invented (per this feature's explicit "do not
  hardcode a follow-up-window rule" instruction).
- **Incomplete Assessments** - Core Assessment Battery not yet complete
  (`core_battery_complete=false`).
- **Missing Instrument** - pick any of the 9 live instruments; shows
  participants NOT complete on it (`missing_instrument=<key>`).
- **Recent Visits** (renamed from "Follow-up Window" 2026-09-09 - same
  filter, label only) - a generic visit-date range filter
  (`visit_date_from`/`visit_date_to`) on the existing `visit_date` field - a
  user-driven date range, not a hardcoded "+N days" protocol rule.
- **Data Review** - registered children with an incomplete demographic
  profile (missing sex/village/age) - a data-quality flag, not a clinical
  rule.

Quick Queries compose with the normal filters (search/sex/village) and are
mutually exclusive with each other (selecting one clears any other active
quick query) - all sent as query params to the same `/dashboard/registry`
endpoint.

**Visual redesign (2026-09-09, presentation-only - no functional/backend
change):** the 5 quick queries render as large equal-width colored cards
(`.quick-query-grid`/`.quick-query-card`, 5-column grid collapsing to 3/2/1
below 1100/700/480px) - icon chip, title, one-line description, tinted
background matching each query's tone: Needs Follow-up = blue, Incomplete
Assessments = amber, Missing Assessment = green, Recent Visits = violet,
Data Review = coral (`--status-critical`). Selecting a card opens a
dedicated white **Active Query Panel** (`.query-control-panel`) below the
grid - icon/title/explanation header plus a divided control row for the
instrument selector (Incomplete Assessments/Missing Assessment) or date
range (Recent Visits); Needs Follow-up and Data Review show only the
explanation, matching their existing logic (no invented follow-up-window
rule). Page order is unchanged: cards -> active query panel -> Child
ID/Sex/Age/Village filters -> matching count + export -> participant table.
Frontend `tsc --noEmit` and `npm run build` both succeed; no backend files
touched.

**Participant table**: Child ID/Sex/Age/Village plus a compact per-instrument
status view (✓/– dot per instrument: SES, DSEQ, Child Illness History, PAQ-A,
Dietary Intake, SSRS Parent/Child/Teacher) and a pipeline-stage `StatusBadge`
(Registered/Core Assessment Battery/SSRS Child/SSRS Teacher) - no long status
text. Row click opens a slide-over **Participant Detail** panel
(registration, status, visit date, pipeline stage, and the same per-instrument
list) - study-statistics-free, participant-level only.

**Participant Detail panel density fix (2026-09-09, presentation-only - no
functional/backend change):** the panel previously listed the 8 instruments
as a single-column text list, leaving most of the fixed-height side panel
visibly empty. It now has a bordered header (Child ID + Sex/Age/Village),
a "Participant Information" section (Registration/Status/Visit
date/Pipeline stage, unchanged data/fields), a divider, and an "Assessment
Status" section header showing an "N/8 completed" count computed client-side
from the same `instrument_status` map already on `RegistryChild`. The 8
instruments render as a 2-column grid of compact tiles
(`.registry-detail-instrument-grid`/`-tile`), each with the existing
`InstrumentDot` plus a "Completed"/"Not completed" line - a completed tile
gets a tinted green background (`--status-good-bg`) so the grid reads as a
scannable status board rather than a plain list, and naturally fills the
panel width/height instead of leaving blank space below a short list. No
REDCap record-URL action was added - no per-record REDCap web URL is
available anywhere in the API response or frontend config (confirmed via
`RegistryChild`/`config.py`), and the task explicitly disallowed inventing
one; add this only if a real record-URL source is confirmed later. Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files touched.

**Result count**: shown above the table/export bar as "N matching
participants" whenever any filter/quick query is active, "N registered
participants" otherwise.

**Query-result evidence for instrument-specific queries (2026-09-09,
presentation-only - no backend/filtering/mapping change):** when Incomplete
Assessments has a specific instrument chosen, or Missing Assessment is
active, the result now visibly ties the count to that instrument instead of
a bare number: a tinted `.registry-result-context` banner reads "N
participants with `<Instrument>` not completed" (never "Incomplete" - the
underlying REDCap completion field has no distinct not-started state, so
display wording deliberately says "not completed" everywhere), plus a small
`.active-filter-chip` (e.g. "DSEQ: Not completed"). The matching column in
the participant table (`th`/`td.registry-instrument-col-highlighted`) gets
a tinted background and bottom accent line so the reason those rows appear
is visually obvious - the ✓/– `InstrumentDot` markers themselves are
unchanged. Both the banner and the column highlight reuse the selected
quick query's existing tone color (`quick-query-tone-*` CSS custom
properties already defined for the Quick Query cards), so amber = Incomplete
Assessments, green = Missing Assessment - no new color system introduced.
Follow-up/Recent Visits/Data Review are not single-instrument queries and
intentionally show no column highlight or chip. **"Core Assessment
Battery" was relabeled to "Core Study Assessments"** in every user-facing
string on this page (quick-query descriptions, the query-control-panel
explanation text, the instrument dropdown's "Any ... instrument" option,
and the Stage column/detail-panel pipeline-stage badge via a new
display-only `displayStage()` helper) - the backend's actual
`progression_stage` value and the `progressionStage` query param sent back
to `/dashboard/registry` are untouched (`"Core Assessment Battery"` is
still the literal string the backend returns/expects; only the on-screen
label is remapped). This rename is scoped to Registry only - Overview/
Assessment Progress still say "Core REDCap Instruments Completed" per the
2026-09-03 rename in that section, unchanged. Frontend `tsc --noEmit` and
`npm run build` both succeed; no backend files touched.

**Export scoped to the current view**: both export buttons now read
"Export Active Cases (Excel/CSV)" when unfiltered, or
"Export matching participants (N) (Excel/CSV)" whenever a filter/quick query
is active - the current search/sex/village/quick-query state is passed as
query params to the export endpoints, so the downloaded file always matches
what the table currently shows (still scoped to *active* cases within that
filtered set - the Active Case definition is unchanged).

**Backend additions supporting this** (`RegistryChild` schema, additive only
- no existing field/calculation changed):
- `instrument_status: dict[str, bool]` - per-instrument completion for all 9
  live instruments (same keys as `ALL_INSTRUMENTS`), read straight from each
  instrument's own REDCap completion field.
- `core_battery_complete: bool` - same `CORE_BATTERY_COMPLETE_FIELDS`
  definition used everywhere else.
- `progression_stage` - same cumulative Registered -> Core Assessment
  Battery -> SSRS Child -> SSRS Teacher definition as the funnel.

New shared filter helper `_apply_registry_filters()` in
`live_dashboard_service.py` (search, sex, village, `missing_instrument`,
`core_battery_complete`, `progression_stage` [comma-separated list of exact
stage names], `visit_date_from`/`visit_date_to`, `data_review`) is used by
BOTH `get_registry()` and `get_active_cases_export()`/
`get_active_cases_csv_export()`, so "export the currently filtered result"
can never diverge from what the Registry table shows. New query params
mirrored on `/dashboard/registry`, `/dashboard/export/active-cases`, and
`/dashboard/export/active-cases.csv` in `api/routes/dashboard.py`. No REDCap
mapping, denominator, analytics/scoring calculation, or the Active Case
definition itself changed.

Verified: backend **127/127** tests pass (6 new registry-filter tests in
`test_live_dashboard_service.py`); frontend `tsc --noEmit` and `npm run
build` succeed. Live-checked against REDCap (212 registered, 44 currently
Core Assessment Battery complete): `instrument_status`/`core_battery_complete`/
`progression_stage` all present and correct on live records; `missing_instrument`,
`core_battery_complete`, `progression_stage` (including the comma-separated
form), and `data_review` filters all cross-checked against the live
`/dashboard/overview` counts; filtered Excel/CSV exports confirmed to contain
only the matching row count. UI interaction was not verified in a live
browser this session (no browser-automation tool was available) - verify
visually before relying on this for a demo.

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

**IMPLEMENTED as real analytics (2026-08-26)** - the Active Cases Excel export's "DOMAIN ANALYSIS" section (see EXPORT FEATURE below) was approved as the official V1 analytical specification, and these four pages now render real live data instead of a placeholder. Source of truth for every metric: `backend/app/services/module_analytics.py` - a shared calculation engine used by BOTH these dashboard endpoints and the Excel export's Summary sheet (export_service.py imports its low-level helpers and field-list constants from this module), so the two can never compute different numbers for the same metric. Population = **all registered children** (same convention as Overview/Demographics/Progress), not "Active Cases" (the export's newsletter-specific scope) - only the underlying arithmetic is shared, not the population filter.

- **Health & Screening** (`/api/v1/dashboard/health`, `HealthScreeningResponse`): Child Illness History instrument completion + 11 named-condition Yes-counts (asthma, heart disease, TB, diabetes, thyroid, anaemia, malnutrition, kidney, liver, recurrent infections, other) + 8 general-flag Yes-counts (currently ill, chronic condition, hospitalised, allergy, vision/hearing difficulty, seizures, developmental diagnosis). No other CHH fields (e.g. health rating, fit-for-assessment) are in the approved dashboard analysis - they're exported in the Excel sheet only.
- **Physical Activity** (`/api/v1/dashboard/physical-activity`, `PhysicalActivityResponse`): PAQ-A instrument completion + Item 1/Item 8/Total score summaries (REDCap-calculated fields `paq_item1_score`/`paq_item8_score`/`paq_total_score`; valid N/missing N/mean/min/max, never treating missing as zero) + a 4-bucket Total score distribution.
- **Screen Time** (`/api/v1/dashboard/screen-time`, `ScreenTimeResponse`): DSEQ instrument completion + Q10 "Average Total Daily Screen Time" distribution + 3 Yes/No items (Q9 household rules, Q14 school use, Q15 entertainment use). Per-item TV/phone/laptop frequency breakdowns exist in the Excel export but are **not** part of the approved dashboard analysis.
- **Neurodevelopment** (`/api/v1/dashboard/neurodevelopment`, `NeurodevelopmentResponse`): SSRS Parent/Child/Teacher, each showing "children with any rating item answered", REDCap completion count, and cohort-level mean-of-per-child-means for the frequency and importance rating scales (same per-child derivation as the Excel export's `<Instrument>: Avg Frequency/Importance Rating` columns, aggregated here with no participant identifiers). Explicitly **not** a validated SSRS composite score. SSRS Teacher (0/212 live completions) shows `valid_n=0`/`mean=null` - computed the same way as Parent/Child, not a special-cased placeholder, so it will populate automatically once real Teacher data exists. The individual SSRS Teacher item ratings (`t43_rating`...`t51_rating`) are **not** part of the approved specification and remain unmapped (see `NEURODEVELOPMENT_STATUS` in `live_field_map.py`).

`backend/app/ingestion/live_field_map.py`'s `HEALTH_SCREENING_STATUS`/`PHYSICAL_ACTIVITY_STATUS`/`SCREEN_TIME_STATUS` ledgers were updated to `available=True` for the metrics now actually computed (documentation correctness only - no dashboard calculation changed); `NEURODEVELOPMENT_STATUS` stays `available=False` since t43-t51 were never approved.

Frontend: `HealthScreening.tsx`/`PhysicalActivity.tsx`/`ScreenTime.tsx`/`Neurodevelopment.tsx` now render real `KpiCard`/`ChartCard`/`CategoryBarChart`/`HorizontalBarChart` components (reused from Demographics/Overview - no new chart components were built) instead of the old `EmptyStateCard` (deleted, no longer used anywhere). Every KPI shows valid-N/missing-N or "of registered" context; a null mean renders as "-" with an explicit "No data acquired (0/N)" sublabel, never a fabricated 0.

Tests: `backend/tests/test_module_analytics.py` (unit tests for every shared calculation) + service-level tests in `test_live_dashboard_service.py` + endpoint tests in `test_dashboard_endpoints.py`. Verified against **live REDCap data**: all 4 endpoints and their pages checked directly against the live API (e.g. Health & Screening 20/212 completed, 1 Anaemia + 1 Liver case; PAQ-A total score mean 2.47 over 19/212; DSEQ Q10 distribution across 20/212; SSRS Parent 20/212 with data, SSRS Teacher correctly 0/212 with null mean) - all cross-checking exactly against the earlier Excel export audit numbers. Backend: **105/105 tests pass**. Frontend build succeeds; both light and dark theme confirmed via headless-browser screenshots with zero console errors.

---

## FRONTEND ERROR ISOLATION (2026-08-26)

**Bug fixed:** all 4 assessment-module routes (`/health-screening`, `/physical-activity`, `/screen-time`, `/neurodevelopment`) white-screened. **Root cause:** those pages destructure/`.map()` the new analytics response shape with no defensive checks (e.g. `data.named_conditions.map(...)`); if the API ever returns something else - the immediate trigger was a stale local backend process still serving the old pre-refactor `UnavailableModule` shape (`available`/`reason`/`unavailable_fields`) on port 8000 - the resulting `TypeError` had no React error boundary anywhere in the tree, so it unmounted the entire app (sidebar and all), not just the broken route.

**Shared fix** (not four per-page patches): `frontend/src/components/RouteErrorBoundary.tsx` (new) - a class-based React error boundary wrapping `<Outlet />` in `frontend/src/components/Layout.tsx`, keyed by `location.pathname` so navigating to a different route automatically clears any tripped error state. A crash in any routed page now shows a contained "Module Unavailable" card (reuses the existing `StatusBadge` component; no data is invented) while the sidebar/topbar/theme stay intact - verified by forcing a malformed API response via Playwright route interception: the broken route showed the fallback, the sidebar remained visible, and navigating to a healthy route recovered cleanly. This protects all routes present and future, not just the four assessment modules. Page components themselves (`HealthScreening.tsx` etc.) were **not** modified - their live-REDCap logic is unchanged.

Small CSS addition in `app.css`: `.route-error-card` / `.route-error-message` (styled consistently with `.chart-card`).

If a module route ever shows this fallback again in local dev, first check for a stale/zombie backend process holding port 8000 from a previous `uvicorn --reload` session (visible via `Get-CimInstance Win32_Process -Filter "Name = 'python.exe'"` even when `Get-NetTCPConnection`'s reported owning PID doesn't resolve via `Get-Process` - the reload parent can be a different, harder-to-see PID than its multiprocessing worker child) - kill it and restart a fresh backend before assuming a code regression.

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

**Global page canvas is pure white (2026-09-09):** the light-theme `body`
rule in `frontend/src/styles/app.css` was changed from a grey/blue-tinted
gradient (`radial-gradient(... rgba(42,120,214,0.07) ...)` over
`--surface-0`/`--surface-0-strong`) to a flat `background: #ffffff`. This is
the single shared rule every page inherits through (`.app-content` has no
background of its own), so all pages - Overview, Registry, Assessments hub,
the 4 assessment detail pages, Demographics, Progress, and the Registry
participant-detail slide-over - now sit on a plain white canvas. Only this
one rule changed: card backgrounds (`--surface-1`/`--surface-2`), Quick
Query tone colors, chart colors, typography, borders, shadows, spacing, and
the top navigation are untouched. `--surface-0`/`--surface-0-strong` remain
defined (still used by the separate `:root[data-theme="dark"] body` rule,
which is unchanged - this was a light-theme-only change). Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files touched.

**Tinted regions brightened (2026-09-09, same day - palette values only, no
layout/component change):** the white canvas above made the existing pastel
tone tints read as washed out, so the shared alpha values behind every
colored tint were raised slightly (still soft/pastel, not saturated/neon).
Changed only CSS custom-property values in `app.css` - no new classes, no
component/JSX changes, no layout/spacing/typography/functionality change:
- Root status backgrounds (`--status-good-bg`, `--status-warning-bg`,
  `--status-neutral-bg`, light theme `#e6f6e6`/`#fdf1dd`/`#eef0f4` -\>
  `#d9f2d9`/`#fbebc7`/`#e6e9f1`; dark theme alphas raised ~0.16-\>0.2) - these
  feed `StatusBadge` (good/warning/neutral) and the coverage
  `.status-flag-tag-*` chips everywhere they're used (Overview, Registry
  Stage column, Assessments, Assessment Progress), so badge/status
  visibility improved consistently across all three areas from one edit.
- `.quick-query-tone-{blue,green,violet,amber,coral}` (Registry Quick Query
  cards, the active-query panel, `.active-filter-chip`, and
  `.registry-instrument-col-highlighted` table-column tint - all already
  shared off these same classes) - soft-tint alpha raised from ~0.08-0.10 to
  ~0.14-0.18, the "-strong" active-state ring alpha from ~0.24-0.26 to
  ~0.30-0.34 (dark-theme equivalents raised proportionally).
- `.kpi-tone-*` and `.snapshot-tone-*` (Overview KPI/Snapshot cards and
  instrument icon chips) bumped by the same proportion, so the tone system
  stays visually consistent between Overview and Registry rather than only
  fixing Registry in isolation.
Text colors, `--series-*`/`--status-good`/`--status-warning`/
`--status-critical` (the saturated foreground/icon colors), white
`--surface-1` card backgrounds, borders, shadows, and every tone's color
*meaning* (which query/instrument/status maps to which hue) are unchanged.
Frontend `tsc --noEmit` and `npm run build` both succeed; no backend files
touched.

**Global vertical spacing tightened (2026-09-09, same day - shared layout
tokens only, no component/content change):** an earlier pass (2026-09-08)
had tightened the above-the-fold header spacing only on Overview, via a
page-specific `.overview-page` CSS override. This pass promoted those same
tightened values into the shared rules every page already uses, so Registry
and the Assessments hub/detail pages now match Overview instead of only
Overview being compact:
- `.app-content`'s top padding (every route's shared content wrapper in
  `Layout.tsx`) went from a uniform `--space-6`/32px to `calc(--space-6 *
  0.6)` ≈ 19px (~40% reduction) - side/bottom padding unchanged.
- `.page-header` margin-bottom: `--space-6` (32px) -\> `--space-4` (16px).
- `.page-header-eyebrow` margin-bottom: `--space-3` (12px) -\> 6px.
- `.page-header-subtitle` margin-top: `--space-2` (8px) -\> 3px.
- `.section-header:first-of-type` (the first section heading on every
  page, e.g. Registry's "Quick Queries") margin-bottom: `--space-4` (16px)
  -\> `--space-3` (12px).
The now-redundant `.overview-page .page-header`/`-eyebrow`/`-subtitle`/
`.section-header:first-of-type` overrides were removed as dead CSS (their
values are now the shared defaults); `.overview-page
.snapshot-strip + .section-header` was kept as-is since it targets a
structure (`.snapshot-strip`) that only exists on Overview. `PageBackNav`
("Back"/"Back to Home", `frontend/src/components/PageBackNav.tsx` +
`.page-back-nav`/`.back-nav-button` CSS) was **not** touched - it keeps its
existing top-right alignment, size, and styling; it simply sits closer to
the nav now because the shared `.app-content` padding above it shrank, the
same effect every page's content gets. No component internal padding,
Quick Query card sizing, chart/table sizing, or PageHeader/SectionHeader
markup changed - only the shared spacing tokens around them. Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files touched.

---

## EXPORT FEATURE - IMPLEMENTED (2026-08-26; CSV format, Excel field-audit expansion, and Excel grouped/analytical refinement all added same day)

**"Export Active Cases"** is implemented on the Participants page as two buttons (Excel + CSV), generated dynamically from live REDCap data (no persistence, no mock data).

Two formats are available: an Excel workbook (3 sheets, for the newsletter) and a flat CSV (single sheet, same approved field set). Both are generated fresh from live REDCap on every request - no caching of the export itself (though the underlying record/metadata fetch still goes through the existing 30s `LiveRedCapRepository` cache).

Backend:
- `backend/app/services/export_service.py` - builds both exports from `RegistryChild` + raw records (already produced by `LiveDashboardService`). No new REDCap fields invented.
- `LiveDashboardService.get_active_cases_export()` (xlsx) and `get_active_cases_csv_export()` (csv) in `backend/app/services/live_dashboard_service.py`.
- Endpoints (both support `?refresh=true` like other endpoints), in `backend/app/api/routes/dashboard.py`:
  - `GET /api/v1/dashboard/export/active-cases` → `.xlsx` bytes, `Content-Disposition: attachment; filename="ICMR_Active_Cases_YYYY-MM-DD.xlsx"`.
  - `GET /api/v1/dashboard/export/active-cases.csv` → UTF-8 (with BOM, for Excel) CSV text, `Content-Disposition: attachment; filename="ICMR_Active_Cases_YYYY-MM-DD.csv"`.
- Dependency added: `openpyxl` (in `requirements.txt`, installed in `.venv`). CSV uses only the stdlib `csv` module.

Excel workbook structure (field-audit expansion 2026-08-26, then refined same day into the current grouped/analytical layout):
- **Sheet 1 - Active Cases**: one row per active child, **103 columns** organized into 10 lettered, merged column groups (row 1) with individual field headers below (row 2) - `A. Registration & Demographics`, `B. SES`, `C. DSEQ`, `D. Child Illness History`, `E. PAQ-A`, `F. Dietary Intake`, `G. SSRS Parent`, `H. SSRS Child`, `I. SSRS Teacher`, `J. Assessment / Progression Status`. Header rows are frozen (`freeze_panes = "A3"`, data starts row 3) and AutoFilter is enabled over the field-header row. Values are real typed data, not strings: dates as `date` objects (`yyyy-mm-dd` format), SES/PAQ-A numeric fields as int/float with number formats (`0`, `#,##0`, `0.00`), categorical fields as REDCap choice labels, blank (`None`) when not collected. Driven end-to-end by one ordered list, `ACTIVE_CASES_FIELD_SPECS` in `export_service.py`, which also generates the Data Dictionary sheet - column set and documentation cannot drift apart.
  - Groups B-F are the field-audit fields (SES raw income + 8 Udai Pareek P2-P9 items, 15 DSEQ items, 34 Child Illness History coded fields, 3 PAQ-A calculated scores, 10 Dietary Intake frequency items) - unchanged from the prior expansion.
  - Groups G/H/I (SSRS Parent/Child/Teacher) now show **real per-child derived summaries** instead of a blanket "not mapped" placeholder: `<Instrument>: Items Answered` (e.g. `"20/52"`), `Avg Frequency Rating`, `Avg Importance Rating` - computed by the export as a simple mean of that child's answered rating items (REDCap codes 0/1/2), explicitly documented as *not* a validated SSRS composite score. Raw per-item fields (92 Parent + 68 Child + 72 Teacher) are fetched (`SSRS_PARENT_FREQ_FIELDS` etc. in `live_field_map.py`, all added to `LIVE_FIELDS`) but not exported as individual columns - this was a user decision (recommended option) over exporting all ~160 raw item columns, to keep the sheet readable. SSRS Teacher's columns use the identical computation (not a special case) and currently show `"0/42"` / blank for every child, since 0 Teacher assessments are complete live - this is a real, dynamically-computed result, not a hardcoded placeholder, and will populate automatically once live Teacher data exists.
  - Group J (new): per-child Complete/Not Complete for Registration + all 8 instruments, plus `Core Assessment Battery` (all six core instruments complete) and `Overall Progression Stage` (highest of Registered/Core Assessment Battery/SSRS Child/SSRS Teacher reached - same cumulative definition as the dashboard's Assessment Progress module, reimplemented locally in `export_service.py` to avoid a circular import, not by modifying that module).
- **Sheet 2 - Assessment Status**: one row per active child - Child ID, Registration, the 8 instrument statuses, **plus new `Core Assessment Battery` and `Overall Progression Stage` columns**. Wording standardized to **"Complete" / "Not Complete"** (previously "Incomplete" - this sheet and Sheet 1's Group J only; the CSV export keeps its original "Complete"/"Incomplete" wording, see below). Complete/Not Complete cells get a light green/neutral fill for at-a-glance scanning. AutoFilter enabled.
- **Sheet 3 - Summary**, retitled **"ICMR Neurodevelopment Study - Active Cases Analysis"**, reorganized into six named sections, each computed dynamically from the exported dataset (never hardcoded): **POPULATION** (active/registered counts, sex/age/village distributions), **SES** (Udai Pareek/BG Prasad category distributions + score summaries, per-capita/raw-income distributions, household-size distribution, the 8 additional Pareek items as tables), **ASSESSMENT ACQUISITION** (instrument-wise completed counts with a real numeric percent column), **ASSESSMENT PROGRESSION** (Registered → Core Battery → SSRS Child → SSRS Teacher counts + stage-to-stage conversion percentages, showing "N/A (no cases reached this stage)" rather than a misleading 0% when a denominator is itself zero), **DOMAIN ANALYSIS** (DSEQ/Child Illness History/PAQ-A/Dietary/SSRS summaries, only computed where real data exists), **DATA COVERAGE** (every instrument bucketed into High/Partial/No-Data-Acquired coverage tiers by its live completion percentage - makes low-coverage instruments immediately visible rather than buried in a long list). All count/percent pairs use real numeric cells with a `0.0%` number format (not formatted strings) so they chart correctly. **14 embedded native bar charts**, all referencing live `'Summary'!` cell ranges (verified, e.g. `'Summary'!$B$56:$B$57`), consistent sizing (8×16, gap width 60, value data labels, no legend clutter), skipped automatically when a table's total is zero. The village chart was changed from Top-15 to a readable **Top-10**, with the full ranked list of all villages kept in the table above it.
- **Sheet 4 - Data Dictionary**: columns renamed to match the requested schema exactly - **Export Column, REDCap Variable, Instrument, Description, Data Type, Acquired vs Derived, Missing-Data Interpretation** - documents every Active Cases column (including the new Group J and SSRS derived columns) plus the Assessment Status columns and an "intentionally excluded fields" list (caste/caste-category, `parent_child_id`/`teacher_child_id`, all free-text `*_spec`/`*_comment`/`*_reason`/`*_remarks` fields, the misleadingly-named `parent_complete`/`teacher_complete` descriptive fields, and now also the 232 raw SSRS rating items that are aggregated rather than exported one-per-column).

**Refinement history**:
- **2026-08-26, field-audit expansion**: added real SES/DSEQ/Child-Illness-History/PAQ-A/Dietary-Intake fields per a live-metadata audit (documented in-conversation, not a repo file). SSRS stayed completion-only at this stage.
- **2026-08-26, same day, refinement pass**: regrouped all Active Cases columns into the 10 lettered sections above, added SSRS Parent/Child real per-child derived summaries (user chose "derived average" over "all raw items" or "frequency-only raw items" when asked, to keep the sheet readable and avoid presenting a naive mean as a validated clinical score), added the Group J progression columns, retitled and restructured the Summary sheet into the 6 named sections, added the Data Coverage section, improved chart consistency/count (13→14, Top-15→Top-10 villages), and expanded the Data Dictionary schema. The CSV export and the Active Case definition were explicitly **not** changed in either pass.
- **Known quirk, not fixed** (shared/existing logic, out of scope to change): `app/ingestion/choice_maps.py`'s bilingual-label stripping splits a choice label on the *first* `/`, which truncates any English choice text that itself contains a mid-word slash - e.g. live DSEQ's "1-2 days/week" resolves to "1-2 days". Affects any such field, dashboard or export; documented in a test comment rather than patched.

CSV structure (`build_active_cases_csv` in `export_service.py`): one flat file, one row per active child. Same demographics/SES columns as the workbook's Sheet 1, followed by a `<Instrument> Status` column (Complete/Incomplete) for all 8 non-registration instruments instead of a separate status sheet. Unlike the workbook, unmapped-instrument values are left **blank** (not the "Not available" placeholder text) per this feature's explicit spec. Exact header order is asserted in `test_csv_header_matches_approved_field_set`.

Active-case definition (shared by both export formats): see "ACTIVE CASE DEFINITION" section above (confirmed with user 2026-08-26; re-confirmed unchanged when the CSV export was added).

Frontend (`frontend/src/routes/Registry.tsx`), two buttons side by side in the same `.export-bar` above the filter bar, each with independent loading/success/error state:
- "Export Active Cases (Excel)" → `exportActiveCases()`.
- "Export Active Cases (CSV)" → `exportActiveCasesCsv()`.
- `frontend/src/api/client.ts` - `apiDownload()` blob-download helper (existing `apiGet` is JSON-only), reused by both buttons.
- `frontend/src/api/dashboard.ts` - `exportActiveCases()` and `exportActiveCasesCsv()`.
- Styles in `frontend/src/styles/app.css`: `.export-bar`, `.export-button` (mirrors `.refresh-button`), `.export-success-text`.

Tests: `backend/tests/test_export_service.py` (workbook structure + CSV structure/header/blank-vs-placeholder behavior/active-case filtering) + endpoint tests for both formats in `backend/tests/test_dashboard_endpoints.py`.

Verified against **live REDCap data** (not just fixtures) on 2026-08-26: backend on port 8000, frontend dev server on port 5173, CSV button clicked via a Playwright-driven headless browser at `/registry` - downloaded `ICMR_Active_Cases_2026-08-26.csv` (213 lines = header + 212 active children, matching the live registered count), correct headers, real child IDs/villages/SES values, blanks where not collected, zero `Dead`-status rows, zero browser console errors, success message rendered.

Re-verified against **live REDCap data** after the field-audit expansion (2026-08-26): fetched a fresh `.xlsx` directly from `/api/v1/dashboard/export/active-cases?refresh=true` and inspected it with openpyxl - 4 sheets, 87-column Active Cases sheet with no caste/free-text/redundant-identifier columns present, real values (e.g. household size, income, DSEQ/CHH/PAQ-A/dietary responses) on children with those instruments complete and correctly blank on children without, 13 charts all referencing live `Summary!` cell ranges, Summary counts cross-checking against known live figures (Core Assessment Battery 20, SSRS Child 4, SSRS Teacher 0 - consistent with the CURRENT LIVE DATA OBSERVATION section above), Data Dictionary sheet documenting all 87 columns plus the exclusion list. No stale/hardcoded literals (`2157`, `172`, `122`, `70`, `67`) present in the changed files.

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

Backend test count: **127/127 passing** (121 as of the 2026-09-03 senior-requirements audit + implementation, +6 for the 2026-09-09 Registry redesign's filter/quick-query logic - see the "Participants (Registry)" section above). Frontend `npm run build` succeeds.

Do not assume this remains true after changes - run the tests.

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
