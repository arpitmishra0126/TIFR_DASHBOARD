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
5. PAQ-C
6. Dietary Intake
7. SSRS Parent
8. SSRS Child
9. SSRS Teacher

The project is classic/non-longitudinal.

**PAQ-A → PAQ-C rename (fixed 2026-09-10):** the live REDCap Physical
Activity instrument was renamed on the REDCap side from "PAQ-A" (form
`paq_a`) to "PAQ C" (form `paq_c`) - confirmed via the REDCap `instrument`
API. REDCap auto-derives a form's completion field name from the form
name, so this also silently changed the completion field from
`paq_a_complete` to `paq_c_complete`. `paq_a_complete` was still hardcoded
in `CORE_BATTERY_INSTRUMENTS` (`live_field_map.py`) and
`build_physical_activity_analysis()` (`module_analytics.py`), so every
`LIVE_FIELDS`-driven record fetch (Overview, Registry, Physical Activity,
the Excel/CSV export) started failing with REDCap's `"The following values
in the parameter 'fields' are not valid: 'paq_a_complete'"` error, surfaced
to the frontend as a 502 on `/dashboard/registry` (and every other
endpoint, since they all share the same record fetch). Fixed by updating
the completion field to `paq_c_complete` in both places, and the display
label from "PAQ-A" to "PAQ-C" everywhere it represents the current live
instrument (`CORE_BATTERY_INSTRUMENTS`'s label, `CORE_BATTERY_DESCRIPTION`,
`build_physical_activity_analysis()`'s `instrument` field). The
`paq_item1_score`/`paq_item8_score`/`paq_total_score` REDCap-calculated
score fields were **not** renamed on the REDCap side and are unchanged.
The internal dict/route key `"paq_a"` (used to match instrument status
across `RegistryChild.instrument_status`, `ALL_INSTRUMENTS`,
`all_instrument_coverage`, and frontend code) was deliberately **left
as-is** - it's a stable internal identifier, never sent to REDCap, same
precedent as `core_assessment_battery` staying an internal key after its
own display-label rename. The Active Cases Excel export's own hardcoded
group header (`_GROUP_E = "E. PAQ-A"`) and Data Dictionary/Summary-sheet
prose in `export_service.py` were deliberately left saying "PAQ-A" -
out of scope for this fix, consistent with this export's established
precedent of frozen wording (see EXPORT FEATURE below) - only the CSV
export's `<Instrument> Status` column header changed automatically to
"PAQ-C Status" since it derives from the now-corrected shared
`CORE_BATTERY_INSTRUMENTS` label (not a separate hardcoded string).
Verified: backend 138/138 tests pass; the full live `LIVE_FIELDS` list
(336 fields, including `paq_c_complete`) is accepted by REDCap's record
export; `/api/v1/dashboard/overview` and
`/api/v1/dashboard/registry?limit=25&offset=0` both return 200 against
live REDCap (212 registered, PAQ-C 44/212 complete, matching the other
core-battery instruments' live completion counts).

Field-level content is mapped into the **dashboard modules** (Overview/Registry/Demographics/Progress) for **Registration** and **SES** only - the other 6 instruments still show only completion status there. Separately, the **Active Cases Excel export** (see EXPORT FEATURE below) additionally reads real acquired/derived field-level data from **DSEQ, Child Illness History, PAQ-C, and Dietary Intake** (approved per the 2026-08-26 field audit) - this is export-only and does not change any dashboard module or calculation. SSRS Parent/Child/Teacher remain completion-status-only everywhere (dashboard and export) - their item-level data is mostly empty in the live project today and was not approved for export. See `backend/app/ingestion/live_field_map.py` for the dashboard field-availability ledger and `backend/app/services/export_service.py`'s `ACTIVE_CASES_FIELD_SPECS` for the export's field-by-field documentation.

---

## CORE ASSESSMENT BATTERY

Core Assessment Battery means ALL SIX of these instruments are complete for the same child:

- SES
- DSEQ
- Child Illness History
- PAQ-C
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

**Known data characteristic - Hindi-only REDCap choice labels, resolved by
a frontend display translation (2026-09-10):** the 10 Dietary Intake
frequency fields' (`die_*_freq`) REDCap choice labels, plus the separate
`die_other_freq` item, are **Hindi-only** (no English segment at all,
confirmed live - unlike most other bilingual fields in this project, which
are "English/Hindi"). `choice_maps.py`'s English-segment extraction has
nothing English to extract for these, so the API still returns/resolves
these labels in Hindi exactly as REDCap defines them - **no backend
mapping, choice code, or stored value was changed**. Per an explicit senior
request that the dashboard present in English, `frontend/src/routes
/DietaryIntake.tsx` now has a small display-only lookup,
`FREQUENCY_LABEL_EN` (the 8 known Hindi choice strings -> English:
Daily/3-6 times per week/1-2 times per week/Once every 15 days/Monthly/
Once every 6 months/Annually/Rarely-Never), applied via
`toEnglishFrequencyLabel()` just before charting the 10 food-group
distributions and before rendering the Other Food Specified table's
Frequency column. A label with no match (should never occur for these 8
known categories) renders unchanged rather than disappearing. This is a
presentation mapping only - REDCap choice codes, the API's resolved label
text, category ordering, and every denominator/calculation are unchanged.

**Dietary Intake - portion size + Other Food Specified (2026-09-09,
implemented after a read-only inspection pass against the senior's
"portion-size x frequency" specification):**

A live REDCap metadata check of the `dietary_intake` form found each of the
10 standard food groups actually has **two** fields, not one:
`die_<group>_freq` (already mapped, `radio`, 8-level ordinal) and
`die_<group>_portion` (**not previously fetched at all** - `text`, free
text, field_note: *"Record local unit (e.g., cup, katori, piece, spoon)
and quantity"*, e.g. live values like `"100 gram"`, `"250"`, `"3Pc"`).
There is also a separate, 11th open-ended item - `die_other_specify`
(free-text food name), `die_other_portion` (free text), `die_other_freq`
(same 8-level scale) - gated by REDCap skip logic (`die_other_portion`/
`die_other_freq` only apply once `die_other_specify` is non-blank; a
group's own `*_portion` only applies when that group's `*_freq` isn't
"rarely/never"). None of these 13 fields were previously in `LIVE_FIELDS`,
so they were never fetched regardless of what REDCap held.

**Implemented** (derivable-only, per explicit instruction not to invent a
portion-size classification):
- All 13 fields added to `DIETARY_EXPORT_FIELDS` in `live_field_map.py`
  (feeds `LIVE_FIELDS`, so they are now actually fetched from REDCap).
- The 10 food groups' frequency distributions are **unchanged** - still
  frequency-only, still `ordered_category_counts()` against the same
  denominators. Portion-size text is fetched but **deliberately not
  charted, categorized, or cross-tabbed with frequency anywhere** - a true
  "portion x frequency" 100%-stacked bar would require bucketing free text
  with inconsistent units (grams vs pieces vs no unit) into invented size
  categories, which no REDCap convention defines. This is called out
  explicitly as a **pending, study-team-defined item** (not an omission)
  in both `DietaryIntakeResponse.notes.scope` and a short note on
  `DietaryIntake.tsx`'s food-group `SectionHeader`.
- New `build_other_food_specified()` in `module_analytics.py` (called from
  `build_dietary_analysis()`) + new `OtherFoodEntry`/
  `OtherFoodSpecifiedSummary` schemas + `DietaryIntakeResponse
  .other_food_specified` field: one entry per child who actually filled
  `die_other_specify` (real text only - names are never grouped/matched
  across children, since fuzzy-matching free-text food names would be the
  same kind of invented-convention problem as portion buckets), each with
  `food_name`, `portion`, `frequency`, and a `portion_status`/
  `frequency_status` of `"recorded"` / `"not_applicable"` (REDCap's own
  skip logic - not counted as missing) / `"not_answered"` (a genuine
  non-response). `DietaryIntake.tsx` renders this as a small
  Food Name/Portion Size/Frequency table (`.table-card`/`.data-table`,
  reused as-is - no new table component) below the 10 food-group charts,
  with an "N/total specified an additional food (%)" line above it and an
  explicit empty state if nobody has. Live-verified: currently **1/212**
  children have specified one (`"Dal Chahal roti Sabji"`, portion
  `"50 grams"`, frequency "1-2 times/week").
- **Naming distinctness preserved**: "Other Vegetables"/"Other Fruits"
  (2 of the 10 *standard* food groups, `die_other_veg_freq`/
  `die_other_fruits_freq`) are unrelated to this 11th open-ended item -
  `DietaryIntake.tsx`'s new section is explicitly labelled "Other Food
  Specified" with a note clarifying it is not a duplicate of those two
  groups.

**Bug fixed in `choice_maps.py::_primary_language_segment`** (shared by
every coded field in the app, not dietary-specific): it previously split
every choice label on the first `/` unconditionally. This is correct for a
genuine "English /Hindi" bilingual label, but the dietary/DSEQ frequency
scale's "rarely/never" option, `"शायद ही कभी/कभी नहीं"`, is **pure Hindi
with no English segment at all** - the `/` there is ordinary punctuation
inside one Hindi phrase, not a language separator - so the old code
silently truncated it to `"शायद ही कभी"` ("rarely"), dropping "/कभी नहीं"
("never"). Fixed by only splitting when the text before the first `/`
contains at least one Latin letter (i.e. there is an actual English
segment to isolate); a label with no Latin text before the `/` is now
returned whole. This does **not** change any existing bilingual field's
behavior (every real "English/Hindi" label has Latin text before the
slash, by definition) and does **not** fix the separately-documented,
still-open quirk where a genuine English segment with its own mid-word `/`
(e.g. `"1-2 days/week / <hindi>"`) still truncates at that first slash -
that stays exactly as before, locked in by
`test_parse_choice_string_still_truncates_english_segment_with_mid_word_slash`.
Live-verified: the "rarely/never" bucket now displays the full Hindi label
correctly across all 10 dietary frequency charts, including buckets with
large real counts (e.g. Flesh Foods 29/44, Eggs 27/44) that were
previously mislabeled.

Tests added: `test_live_field_map.py` (new file - the 13 fields are in
`DIETARY_EXPORT_FIELDS`/`LIVE_FIELDS`), 2 new cases in
`test_choice_maps.py` (Hindi-only label preserved whole; existing
mid-word-slash quirk unchanged), 1 new integration test in
`test_module_analytics.py` (`build_other_food_specified` - skip-logic
statuses, real-entry-only inclusion, denominators), plus an assertion added
to the existing `/dietary-intake` endpoint test. Backend: **138/138 tests
pass**. Frontend `tsc --noEmit` and `npm run build` both succeed.

**Remaining limitation (explicitly not resolved by this change)**: portion
size for the 10 standard food groups still has no categorical
representation anywhere in the dashboard - the "100% stacked bar of
portion-size x frequency" from the original specification requires the
study team to define a portion-size classification (unit conversion and/or
size buckets) before it can be built without guessing. Raw portion text is
now fetched into `records` but not yet exposed on `DietaryFoodItem` or
`DietaryIntake.tsx` for the 10 groups (only for the separate Other Food
Specified table, where it's shown as plain text, not categorized).

**Spacing/text cleanup (2026-09-09, same day - UI only, no
calculation/mapping change):** the gap between the Instrument Completion
badge and the "Consumption frequency by food group" heading used the
shared `.module-status-line` margin-bottom (`--space-5`/24px), which reads
as too generous now that the rest of the dashboard's above-the-fold
spacing has been tightened. Fixed with a page-scoped override,
`.dietary-intake-page .module-status-line { margin-bottom: --space-3; }`
(root `<section>` now carries a `dietary-intake-page` class) - scoped to
this page only, since `.module-status-line` is shared by Health &
Screening/Physical Activity/Screen Time too and those were left unchanged.
Also removed the long explanatory `note` text on that same `SectionHeader`
("Category order follows..."/"Portion size... pending a study-team-defined
classification") - no replacement text was added. The underlying
denominators, category ordering, completion count, and the pending-
portion-size limitation itself are all unchanged and still documented
above in this section and in `DietaryIntakeResponse.notes.scope` - only
this one on-page sentence was removed. `PageBackNav` ("Back"/"Back to
Home") is rendered by `Layout.tsx`, not this page, and was not touched.
Frontend `tsc --noEmit` and `npm run build` both succeed; no backend files
touched.

**Food-group chart visual refinement (2026-09-09, same day - presentation
only, no data/calculation/mapping/category change):** the 10 food-group
charts felt heavily rounded and sparse (a lot of empty space around thin
bars). Fixed via two new **opt-in** capabilities on the shared components
already used dashboard-wide, not one-off styling for any single chart:
- `ChartCard` gained a `compact?: boolean` prop -> adds a `chart-card-
  compact` class (`app.css`): padding reduced to `space-3`/`space-4`,
  `margin-bottom: 0` (relies on `.chart-grid`'s own `gap` instead of
  double-spacing), border-radius switched to the existing `--radius-
  control` token (8px, sharper than the default `--radius-card` 14px -
  reusing an existing design-system value, not a new one), and the title-
  subtitle gap tightened. Every other `ChartCard` caller (Overview,
  Demographics, Health & Screening, Physical Activity, Screen Time,
  Assessment Progress, Neurodevelopment) omits this prop and is completely
  unaffected.
- `HorizontalBarChart` gained a `dense?: boolean` prop (also added to the
  exported `computeHorizontalBarChartHeight(datasets, labelWidth, dense)`,
  so the page-level shared-height calculation and the chart's own internal
  sizing can never drift apart). A new internal `GEOMETRY` table holds
  `normal` (unchanged: 44px row height, 26px bars, `[0,7,7,0]` radius, 30%
  category gap, `{top:4,right:68,left:0,bottom:4}` margin) vs `dense` (28px
  row height, 16px thinner bars, `[0,3,3,0]` smaller radius - no longer
  pill-shaped, 14% category gap, `{top:2,right:58,left:0,bottom:2}`
  margin), selected by the prop. Every other caller (Demographics' village/
  SES charts, Overview's SES chart) omits `dense` and renders exactly as
  before. Axis/tick typography, gridline styling, the `n (%)` end-of-bar
  `LabelList`, and the tooltip are all untouched.
- `DietaryIntake.tsx` passes `compact`/`dense` only on its 10 food-group
  `ChartCard`/`HorizontalBarChart` calls (`computeHorizontalBarChartHeight`
  called with `dense=true` too, so all 10 stay the same height as each
  other, per the existing shared-height convention). The category set (all
  8 frequency levels, including zero-count ones), category order, Hindi
  choice labels, denominators, and completion count are all unchanged -
  confirmed by re-reading the diff before considering this done: no
  `module_analytics.py`/schema/service file was touched. The separate
  "Other Food Specified" table section is unaffected (different markup,
  not a `ChartCard`).
Frontend `tsc --noEmit` and `npm run build` both succeed; no backend files
touched.

**Vertical label/bar misalignment fixed (2026-09-09, same day - shared
`HorizontalBarChart` fix, verified with a real headless-browser render):**
the density refinement above caused some food-group charts (e.g. Dairy) to
show Y-axis category labels that didn't line up with their bars. Root
cause, confirmed by inspecting the live-rendered SVG DOM (not just static
reasoning - installed a scratch Playwright/Chromium instance and measured
actual tick/bar pixel positions): recharts' `<YAxis type="category">` has
no `interval` prop set, so it defaults to `interval="preserveEnd"` and
**silently drops ticks it estimates would collide** using its own generic
size guess - at `dense` mode's tighter 28px row height, this was dropping
up to half of a chart's 8 category ticks (measured: only 4 of 8 rendered
for Dairy). A category still got a bar (bars are driven independently by
`data`, unaffected by axis tick-skipping) but no tick of its own nearby -
reading exactly as "label between bars." Fix:
added `interval={0}` to `HorizontalBarChart`'s `<YAxis>` (unconditional,
not `dense`-gated - every category must always show its own label, so
this isn't a density-specific fix) forcing all 8 ticks to always render.
A separate, smaller issue found during the same measurement pass: even
with all 8 ticks present, each was consistently 4-5px off from its bar's
true center (baseline-anchored SVG `<text>` vs. the bar's geometric
center) - harmless at the old 44px row height, more visible at 28px. Fixed
by adding `dominantBaseline="central"` to the custom tick's `<text>` in
`makeCategoryTick()`. Re-measured after both fixes: every one of the 10
food-group charts' non-zero bars now aligns with its tick within 0-1px,
all 8 categories (including every zero-count one, e.g. Grains' 5 zero-count
rows) render with reserved row space and no bar, and the compact/dense
visual design, bar thinness/radius, colors, category order, and Hindi
labels are all unchanged - confirmed visually via saved screenshots of
Dairy, Grains (many zero-count rows), and Nuts and Seeds, plus a full-page
screenshot of all 10 charts together. No `module_analytics.py`, schema, or
service file was touched - this was a pure `HorizontalBarChart.tsx`
rendering fix, so it applies identically wherever this shared component is
used (Overview/Demographics' SES and village charts get the same
`interval={0}`/`dominantBaseline` correctness fix in `normal` mode too,
with no visible change there since they were never hitting recharts'
tick-skipping threshold in the first place). Backend: 138/138 tests pass
(unaffected). Frontend `tsc --noEmit` and `npm run build` both succeed.

**English chart labels + slightly more vertical row spacing (2026-09-10,
presentation-only, no data/calculation/mapping change):** two senior-
requested refinements, both scoped to Dietary Intake's charts:
- **English labels**: see the "Known data characteristic" note above -
  `DietaryIntake.tsx` now translates the 8 Hindi `die_*_freq`/`die_other_freq`
  choice labels to English for display via a local lookup
  (`FREQUENCY_LABEL_EN`/`toEnglishFrequencyLabel()`), applied to the 10
  food-group chart distributions and the Other Food Specified table's
  Frequency column. Backend/API/REDCap side is completely unchanged.
- **Row spacing**: `HorizontalBarChart.tsx`'s `dense` geometry (used only by
  Dietary Intake - confirmed no other page opts into `dense`) had its
  `rowHeight` raised from 28 to 32px and `categoryGap` from 14% to 20%;
  `barSize` (bar thickness) is unchanged, so this adds breathing room
  around each bar rather than enlarging the bars themselves. Both
  `computeHorizontalBarChartHeight()` and the multi-line tick renderer read
  the same `GEOMETRY.dense.rowHeight` constant, so row-height alignment
  (bars centered in their row, ticks matching their bar) stays exact - no
  separate fix needed. Since `dense` is Dietary-Intake-only today, no other
  page's charts are visually affected by this change.
Re-verified visually via a full-page headless-browser screenshot against
live REDCap data: all 10 food-group charts show English labels, all 8
categories (including zero-count ones, e.g. Grains' zero-count rows) still
render with reserved row space, bars remain aligned with their labels, and
the extra vertical spacing is clearly visible without reintroducing the
excessive whitespace the earlier density pass had removed. Frontend
`tsc --noEmit` and `npm run build` both succeed; no backend files touched
(backend: 143/143 tests still pass, unaffected).

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

**Header status-control vertical centering + timestamp contrast (2026-09-10,
CSS-only, no functional change; refined same day - see below):** the live
badge/last-updated/refresh/theme-toggle group in `.topnav-header-row` read
as pinned to the row's top edge. `.last-updated` gained
`color: var(--text-secondary)` (darker than the previous inherited
`--text-muted`) and `font-weight: 600` for stronger contrast against the
white header; the live badge and buttons' own colors/styling are
untouched.

The first attempt at the vertical fix used a `position: relative; top: 2px`
nudge on `.topnav-status`/`.app-topbar`. Measurement showed the group was
already within ~1px of `.topnav-header-row`'s true center (that row's
height is set almost entirely by the 34px theme-toggle button + its own
padding), so a pixel-offset hack was the only way to move it at all - it
didn't survive review. **Refined fix (same day):** real padding
redistributed between the header's two rows instead, with zero pixel
hacks and centering left entirely to the existing `align-items: center`:
`.topnav-header-row`'s padding is now top-biased, `1rem var(--space-6)
0.6rem` (was `0.65rem var(--space-6) 0.5rem`), and `.topnav-links`'
bottom padding was reduced by the exact same amount it grew by, `0.15rem
var(--space-6) 0.2rem` (was `0.15rem var(--space-6) 0.65rem`). Measured
before/after: `.app-topnav`'s total height is unchanged (96.6px both
times, sub-pixel rounding only); the status/control group's content now
sits a real, visible 5.6px lower with balanced padding around it (16px
top / ~10px bottom around the 34px-tall content, vs. the original tight
10.4px/8px); nav-link elements themselves (size, gap, position relative to
each other) are pixel-identical before/after - only the whitespace *below*
the nav-links row (before page content starts) shrank by the same ~7.6px
the status row gained, keeping the header's combined height fixed without
touching link items. `align-items: center` (unchanged, already present on
both rows) does the actual centering, so this holds responsively at any
viewport width, including the icon-only mobile layout below 900px.
Verified with headless-browser screenshots + `getBoundingClientRect()`
measurements before and after. Frontend `tsc --noEmit` and `npm run build`
both succeed; no backend files touched.

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
- **Physical Activity** (`/api/v1/dashboard/physical-activity`, `PhysicalActivityResponse`): PAQ-C instrument completion + Item 1/Item 8/Total score summaries (REDCap-calculated fields `paq_item1_score`/`paq_item8_score`/`paq_total_score`; valid N/missing N/mean/min/max, never treating missing as zero) + a 4-bucket Total score distribution.

**PAQ-C Key Scores section (2026-09-10, `PhysicalActivity.tsx` only - no
backend field/schema/calculation change):** a compact 3-card "PAQ-C Key
Scores" `KpiCard` row (reusing the existing `.kpi-row`/`KpiCard` design
language, no new components) was added directly below the Instrument
Completion badge and before the Total score distribution chart, replacing
the page's previous ad-hoc "Item 1/Item 8/Total score" KPI row. Traced
against the live `paq_c` REDCap form's metadata (including each `calc`
field's own formula) before implementing:
- **Final PAQ-C Score** = `total_summary` (`paq_total_score`) - REDCap's
  own calc, `(item1 + q2..q7 + item8)/8`; its field label already says
  "excludes item 9" (REDCap's numbering for the illness/exclusion item,
  `paq_q9_sick`) - the only "final" score field on the instrument, and it
  already satisfies "the exclusion item is not included" with no code
  change needed.
- **Item 9 Score** = `item8_summary` (`paq_item8_score`) - REDCap's own
  calc, the mean of `paq_q8_mon`..`paq_q8_sun` (each on the approved
  None=1/Little=2/Medium=3/Often=4/Very often=5 scale).
- **Daily Activity Score** = the **same** `item8_summary` value. The
  approved spec's own text ("Daily Activity Score: Item 8 scored
  None=1...Very often=5") describes the identical Monday-Sunday scale as
  "Item 9 Score" ("mean of Monday-Sunday scores") - there is no second,
  independently-collected REDCap field for a distinct Daily Activity
  Score anywhere on the live `paq_c` form, so both cards intentionally
  read the same summary rather than inventing a second calculation. This
  is documented in code comments and locked in by a new backend test,
  `test_physical_activity_key_scores_match_approved_paqc_specification`
  in `test_module_analytics.py`.
Each card shows the mean (2 dp), a static "Range 1–5" (the instrument's
fixed theoretical scale, not participant data), and `n=valid/total (%)`.
The former "Item 1 composite score" KPI card was dropped from the visible
row (the underlying `item1_summary` field is unchanged in the API
response, just no longer surfaced as its own KPI here) since it isn't
part of this 3-card approved spec. The Total score distribution chart
itself, its data, and its calculation are unchanged - only the page's
title/subtitle were also corrected from the stale "PAQ-A" to "PAQ-C" for
consistency with the new section (the chart's own "PAQ-A total score"
title text was deliberately left as-is, out of scope for this pass).
Live-verified: `total_summary` mean 2.33 (n=43/212), `item8_summary` mean
2.94 (n=44/212), both within the 1-5 range. Backend: **139/139 tests
pass**. Frontend `tsc --noEmit` and `npm run build` both succeed; verified
visually via a headless-browser screenshot with zero console errors.

**PAQ-C page scoring correction + restructuring (2026-09-10, same day,
supersedes the "PAQ-A total score" chart above):** the Key Scores cards
above were correct, but the page below them still had the old chart
literally titled "PAQ-A total score" with a stale subtitle, no item-level
analysis, and a long implementation-note paragraph exposed to dashboard
users. Fixed per the approved PAQ-C scoring specification (Items 1-9 mean
= Final PAQ-C Score; Item 10 separate/excluded):
- **Field-fetch bug found and fixed**: `paq_q2_pe`..`paq_q7_describe`
  (Items 2-7), `paq_q8_mon`..`paq_q8_sun` (the 7 Monday-Sunday day fields),
  and `paq_q9_sick` (Item 10) were **never added to `LIVE_FIELDS`** - only
  the three calc fields (`paq_item1_score`/`paq_item8_score`/
  `paq_total_score`) were ever fetched from REDCap, so any per-item/
  per-day/Item-10 analysis had zero real data available even though the
  fields exist and are populated live. Added all 14 to `PAQA_EXPORT_FIELDS`
  in `live_field_map.py` (feeds `LIVE_FIELDS`) - confirmed by live-checking
  the `/physical-activity` endpoint before and after: before, `item_scores`
  2-7/`weekly_activity`/`item10_exclusion` all showed `valid_n=0`/`mean:
  null` despite 44/212 completions; after, all populate correctly (e.g.
  Item 2 mean 2.45 n=44, Sunday mean 4.57 n=44, Item 10 1 Yes/43 No n=44).
- New constants in `module_analytics.py`: `PAQC_ITEM_FIELDS` (8 entries,
  Items 1-8 per the approved numbering - Item 8 here is REDCap's own
  `paq_item8_score`, i.e. the Monday-Sunday mean, since the approved spec's
  numbering runs one higher than REDCap's own field labels from this point
  on - documented in a code comment so the discrepancy isn't rediscovered
  each session), `PAQC_WEEKDAY_FIELDS` (the 7 day fields), `PAQC_ITEM10_FIELD`/
  `_LABEL` (`paq_q9_sick`). `build_physical_activity_analysis()` now
  additionally returns `item_scores` (list, one `numeric_summary` per Item
  1-8), `weekly_activity` (list, one `numeric_summary` per weekday), and
  `item10_exclusion` (a `build_condition_indicator()` Yes/No/Don't-know
  breakdown, `asked_n` = PAQ-C completion count - the existing
  denominator-discipline helper, reused as-is, not reimplemented). New
  schemas `ScoredItemSummary`/`WeeklyActivityDay` in `dashboard.py`;
  `PhysicalActivityResponse` gained `item_scores`/`weekly_activity`/
  `item10_exclusion`. 4 new backend tests in `test_module_analytics.py`
  (`test_physical_activity_item_scores_cover_items_1_through_8_...`,
  `test_physical_activity_weekly_activity_covers_all_seven_days`,
  `test_physical_activity_item10_exclusion_is_separately_denominated_...`)
  lock in the field mapping and denominators.
- `PhysicalActivity.tsx`: removed the long `chart-card-note` paragraph
  below the Key Scores cards (implementation/debug commentary, not
  dashboard content - per this task's explicit instruction). Relabeled the
  distribution chart from "PAQ-A total score"/"Mean of items 1-8 (excludes
  item 9)" to **"Final PAQ-C Score Distribution"**/"Final PAQ-C Score" -
  same underlying data (`paq_total_score`, already the mean of the approved
  spec's Items 1-9 excluding Item 10 - no calculation change, label only).
  Added three new sections: **"Items 1-8"** (a `GroupedBarChart` of each
  item's mean score, one series, reusing the shared component - not a new
  chart type), **"Item 9 - Monday-Sunday Activity"** (a `GroupedBarChart` of
  each weekday's mean rating), and **"Item 10"** (`ConditionCompositionChart`
  - the same Yes/No/Don't-know composition bar already used by Child
  Illness History - fed a single-item list, with an explicit subtitle
  stating it is "not included in the Final PAQ-C Score"). No new
  statistical method was introduced - every new number is a direct
  `numeric_summary`/`build_condition_indicator` over an existing field.
- **Stale "PAQ-A" sweep**: `Registry.tsx`'s `INSTRUMENT_COLUMNS` row
  (`short`/`label`) and `ScreenTime.tsx`'s Physical Activity section note
  both said "PAQ-A" referring to the current instrument - corrected to
  "PAQ-C" (the internal `key: "paq_a"` identifiers in `Registry.tsx` and
  `AssessmentsHub.tsx` were left unchanged, per the established
  don't-rename-internal-identifiers precedent from the original rename).
  The Active Cases Excel export's own "PAQ-A" column groups/headers/chart
  titles (`export_service.py`) remain **unchanged** - out of scope, same
  precedent as every other export-vs-dashboard terminology split
  documented elsewhere in this file.
Backend: **142/142 tests pass**. Frontend `tsc --noEmit` and `npm run
build` both succeed. Live-verified against a local backend hitting the
live REDCap project (212 registered, 44/212 PAQ-C complete): Item 2 mean
2.45, Item 3 mean 3.07, Item 4 mean 2.0, Item 5 mean 2.27, Item 6 mean
1.95, Item 7 mean 2.59 (all n=44/212); Monday-Sunday means 2.45/2.55/3.02/
2.43/2.43/3.16/4.57 (all n=44/212); Item 10 1 Yes/43 No (n=44/212,
asked_n=44). No browser-automation tool was available this session, so
pixel-level visual QA of the new charts was **not** performed - verify
visually before treating this as demo-ready.

- **Screen Time** (`/api/v1/dashboard/screen-time`, `ScreenTimeResponse`) - superseded 2026-09-09, see the dedicated section below. DSEQ instrument completion + Q10 "Total Daily Screen Time" distribution + Q9/Q14/Q15 Yes/No items are kept as **secondary/descriptive** fields; the page's primary analysis is now a derived continuous minutes-per-day variable.
- **Neurodevelopment** (`/api/v1/dashboard/neurodevelopment`, `NeurodevelopmentResponse`): SSRS Parent/Child/Teacher, each showing "children with any rating item answered", REDCap completion count, and cohort-level mean-of-per-child-means for the frequency and importance rating scales (same per-child derivation as the Excel export's `<Instrument>: Avg Frequency/Importance Rating` columns, aggregated here with no participant identifiers). Explicitly **not** a validated SSRS composite score. SSRS Teacher (0/212 live completions) shows `valid_n=0`/`mean=null` - computed the same way as Parent/Child, not a special-cased placeholder, so it will populate automatically once real Teacher data exists. The individual SSRS Teacher item ratings (`t43_rating`...`t51_rating`) are **not** part of the approved specification and remain unmapped (see `NEURODEVELOPMENT_STATUS` in `live_field_map.py`).

`backend/app/ingestion/live_field_map.py`'s `HEALTH_SCREENING_STATUS`/`PHYSICAL_ACTIVITY_STATUS`/`SCREEN_TIME_STATUS` ledgers were updated to `available=True` for the metrics now actually computed (documentation correctness only - no dashboard calculation changed); `NEURODEVELOPMENT_STATUS` stays `available=False` since t43-t51 were never approved.

Frontend: `HealthScreening.tsx`/`PhysicalActivity.tsx`/`ScreenTime.tsx`/`Neurodevelopment.tsx` now render real `KpiCard`/`ChartCard`/`CategoryBarChart`/`HorizontalBarChart` components (reused from Demographics/Overview - no new chart components were built) instead of the old `EmptyStateCard` (deleted, no longer used anywhere). Every KPI shows valid-N/missing-N or "of registered" context; a null mean renders as "-" with an explicit "No data acquired (0/N)" sublabel, never a fabricated 0.

Tests: `backend/tests/test_module_analytics.py` (unit tests for every shared calculation) + service-level tests in `test_live_dashboard_service.py` + endpoint tests in `test_dashboard_endpoints.py`. Verified against **live REDCap data**: all 4 endpoints and their pages checked directly against the live API (e.g. Health & Screening 20/212 completed, 1 Anaemia + 1 Liver case; PAQ-A total score mean 2.47 over 19/212; DSEQ Q10 distribution across 20/212; SSRS Parent 20/212 with data, SSRS Teacher correctly 0/212 with null mean) - all cross-checking exactly against the earlier Excel export audit numbers. Backend: **105/105 tests pass**. Frontend build succeeds; both light and dark theme confirmed via headless-browser screenshots with zero console errors.

---

## SCREEN TIME (DSEQ) PAGE - REBUILT 2026-09-09 (senior DSEQ specification)

Scope of this change: **only** `/screen-time` (`frontend/src/routes/ScreenTime.tsx`),
its backend builder (`build_screen_time_analysis` in
`backend/app/services/module_analytics.py`), `ScreenTimeResponse` and its
new nested schemas (`backend/app/schemas/dashboard.py`), and
`LiveDashboardService.get_screen_time()`. Overview, Registry, the other
three assessment pages, and every other backend mapping/calculation are
unchanged.

**PRIMARY RULE (per the senior spec):** average daily screen time is
analysed as a **continuous minutes-per-day variable**, not as the DSEQ Q10
category. DSEQ Q10 stays on the page only as a secondary, purely
descriptive cross-check.

**Field-metadata finding that shapes everything below (confirmed live
2026-09-09 via a direct REDCap `metadata` call for the `dseq` form):**
**every** DSEQ field is a `radio` (4-5 level ordinal band) - there is **no**
raw-minutes text/number field anywhere on the instrument, for screen time
*or* physical activity. Per CLAUDE.md's "never assume a variable exists
without checking metadata" / "if a metric is unavailable, say so" rules,
this ruled out reading a literal minutes value from REDCap; instead each
ordinal *code* (not label text, which has a documented bilingual
slash-splitting quirk elsewhere - see `choice_maps.py`) is converted to the
**midpoint of its band, in minutes** - a standard, transparent
survey-research convention for turning banded categories into an
analysable continuous proxy, not a fabricated per-child value. Every KPI/
chart built on this says "estimated"/"est." - never presented as an exact
duration. The open-ended top band of every field (e.g. "more than 2 hours")
has no REDCap-defined upper bound; its minute value is a documented,
conservative approximation (one half-band-width past the band's lower
bound). All conversion tables/logic live in one place:
`_SCREEN_BAND_MINUTES` / `_TOTAL_SCREEN_BAND_MINUTES` /
`_ACTIVITY_BAND_MINUTES` / `_band_minutes()` / `_weighted_daily_minutes()`
in `module_analytics.py`.

**Primary continuous variable derivation:** per child, `school_day` minutes
= TV-on-a-school-day (`q2_tv_school`) + smartphone/tablet-on-a-school-day
(`q5_phone_school`) band-midpoints; `weekend` minutes = TV-on-a-holiday
(`q3_tv_holiday`) + smartphone/tablet-on-a-holiday (`q6_phone_holiday`).
**Laptop/computer (`q7_laptop_freq`) is deliberately excluded from every
minutes total** - REDCap only captures its weekly-use *frequency*, never a
duration, so there is no genuine variable to convert; inventing one would
violate the "use only variables that actually exist" rule. The primary
"Average Daily Screen Time" = a 5(school-day):2(weekend) weighted average
of those two totals - `(school*5 + weekend*2)/7` - computed **only** when
both sides are valid for that child (a missing side is never imputed as 0,
so it correctly drops that child from this metric's `valid_n` rather than
pulling the average down). The same pattern (weighted 5:2 average, missing
side never zero-filled) is reused for DSEQ's own Section B outdoor-play
items (`q11_outdoor_school`/`q12_outdoor_holiday`) to produce the page's
"Physical Activity" section - this is DSEQ's own outdoor-play question,
**distinct from the separate PAQ-A-based Physical Activity page**, so
nothing is duplicated across pages.

**`ScreenTimeResponse` (new/changed fields):** `missing_count`/
`missing_percent` (instrument-level, `total - completed`); `MinutesSummary`
(`valid_n`/`missing_n`/`total`/`percent_valid`/`mean`/`median`/`minimum`/
`maximum` - median added alongside the existing `numeric_summary` pattern
via a new `minutes_summary()` helper) for `average_daily_summary`,
`school_day_summary`, `weekend_summary`, `difference_summary`,
`physical_activity_school_day_summary`, `physical_activity_weekend_summary`;
`PairedMinutesPoint` lists `school_vs_weekend` and
`physical_activity_school_vs_weekend` (School-Day/Weekend mean+median+
valid_n); `GroupedMinutesPoint` lists `by_age` (8/9/10 years only, per the
spec) and `by_sex` (Male/Female); `DeviceMinutes` list `by_device`
(Television, Smartphone/Tablet, and Laptop/Computer with `mean_minutes:
null`/`valid_n: 0` - never fabricated); `screen_time_distribution_minutes`
and `difference_distribution` (histogram buckets, `CategoryCount`);
`purpose_distribution` (Q13), `supervision_distribution` (Q8, ordinal-
ordered), `household_rules_distribution` + `household_rules_valid_n` (Q9,
now a real Yes/No pair instead of a single Yes-count);
`screen_vs_activity_scatter` (`ScreenActivityPoint` list, one point per
child with **both** a valid weighted screen-time and weighted
physical-activity value - empty, not fabricated, if no child qualifies).
`total_screen_time_distribution` (Q10) and `yes_no_items` (Q9/Q14/Q15) are
kept unchanged as the secondary/descriptive fields.

**Frontend (`ScreenTime.tsx`), infographic-first, in this order:** Screen
Time Summary (6 KPI cards: DSEQ Completed, Average Daily (est.), Median
Daily (est.), School-Day (mean+median), Weekend (mean+median), Missing DSEQ
Data) → School-Day vs Weekend (paired bar of mean/median + the Weekend−
School-Day difference KPI/histogram) → Screen-Time Distribution (histogram
of the estimated minutes, plus Q10's category distribution kept as a
labelled secondary chart) → Screen Time by Demographics (age 8/9/10 and sex
grouped bars) → Screen Use & Supervision (device stacked bar with an
explicit laptop-exclusion note, purpose donut, supervision bar, household-
rules donut) → Physical Activity (DSEQ Section B paired bar + the screen-
vs-activity scatter, both showing an explicit "no data" message instead of
an empty/fake chart when `valid_n` is 0) → the pre-existing Q9/Q14/Q15
Yes/No behavioural-indicator list (unchanged, kept for continuity) →
**Future Cognitive/Developmental Analysis**: 5 static "Under Development"
placeholder cards (Screen Time × SANGIAN/Visual Working Memory/DCCS/Colour
Detection Task/ASER) reusing the Assessments-hub's existing
`.instrument-card`/`.instrument-card-placeholder` styling - no backend
field, no fake numbers, no zero-value charts for these five.

**New shared frontend chart components** (not page-specific, reusable by
any future page): `frontend/src/components/charts/GroupedBarChart.tsx`
(grouped or `stacked` multi-series bar chart, used for the paired School-
Day/Weekend bars, age/sex grouped bars, and the device stacked bar) and
`frontend/src/components/charts/ScreenActivityScatter.tsx` (Recharts
scatter plot for the screen-time-vs-activity comparison). `CategoryBarChart`
(existing) is reused for every histogram (bucket labels + counts) rather
than building a separate histogram component.

Verified against **live REDCap data** (212 registered, 44/212 DSEQ
complete at time of check): average daily 48.2 min (median 45), school-day
mean 45.7/median 45, weekend mean 54.5/median 45, difference mean +8.9 min;
age 9 mean 47.3 (n=40), age 10 mean 57.9 (n=4), no age-8 children currently
(`valid_n: 0`, `mean: null`, not fabricated); sex Male 52.5 (n=25) / Female
42.6 (n=19); device TV 8.3 min / Smartphone 39.9 min / Laptop `null`
(n=0); household rules 23 Yes / 21 No; all denominators cross-check
internally (e.g. age 40+4=44, sex 25+19=44, household 23+21=44, matching
`completed`). Backend: **131/131 tests pass** (127 prior + 4 new -
`_band_minutes`/`_weighted_daily_minutes` unit tests plus one full
`build_screen_time_analysis` integration test covering missing-side
exclusion, by-age/by-sex/by-device denominators, and the scatter filter).
Frontend `tsc --noEmit` and `npm run build` both succeed. A local backend +
`vite` dev server confirmed the live endpoint and the `/screen-time` route
both serve successfully; no browser-automation/screenshot tool was
available this session, so pixel-level visual QA (chart rendering, both
themes) was **not** performed - verify visually before treating this as
demo-ready.

**Refinement pass (2026-09-09, same day):**
- **KPI layout fix**: the 6 Screen Time Summary cards previously used the
  shared `.kpi-row` (`auto-fit, minmax(200px, 1fr)`), which at common
  viewport widths fit 5 columns and left the 6th ("Missing DSEQ Data")
  alone on its own row. New CSS modifier `.kpi-row-balanced-6` (scoped to
  this page only, not a change to `.kpi-row` itself) forces a fixed
  3-column grid (2 even rows of 3), collapsing to 2 then 1 column below
  860px/480px.
- **Average Daily Screen Time KPI reworded** to "Estimated Average Daily
  Screen Time" with sublabel "5:2 school-day/weekend weighted estimate -
  n=X/Y - median Z min", making the derivation method and its estimated
  (not measured) nature explicit in the KPI itself, not just the page
  subtitle. Calculation is unchanged.
- **Weekend − School-Day Difference histogram**: `module_analytics.py`'s
  `_DIFF_MINUTES_BUCKET_EDGES`/`_LABELS` changed from 5 broad, qualitatively
  hand-labelled buckets ("More than 30 min less on weekends", etc.) to 6
  numeric-range bins (`< -60 min`, `-60 to -30 min`, ... `60+ min`) - a
  true histogram of the derived difference rather than manually-labelled
  categories. The underlying calculation (`weekend_total - school_total`
  per child, `bucket_counts()`) and denominators are unchanged; valid n is
  shown in the chart's subtitle.
- **Age/sex sample sizes made permanently visible**: `ScreenTime.tsx`'s
  `groupedToBar()` now folds `n=` into the chart's own group/axis label
  (e.g. "9 years (n=40)", "Male (n=25)") for the by-age and by-sex charts,
  not only in the hover tooltip, so a displayed mean is never shown without
  its denominator alongside it. `pairedToGrouped()` (School-Day/Weekend,
  PA School-Day/Weekend) is unchanged - it already carries n via tooltip
  and its own subtitle/KPI text.
- **Device limitation note tightened** to one concise sentence ("Laptop/
  computer excluded - REDCap records only its weekly-use frequency, not
  duration.") - same fact, less text; no computation change.
- **"Key behavioural indicators" (Q9/Q14/Q15) section removed** from
  `ScreenTime.tsx` - Q9 (household rules) duplicated the already-present
  Household Screen Rules donut in Screen Use & Supervision, and Q14/Q15
  were carried over from the pre-2026-09-09 approved scope rather than
  being part of the senior's DSEQ redesign's required visual list, so per
  this task's explicit instruction the whole section was removed rather
  than partially kept. `data.yes_no_items` remains in `ScreenTimeResponse`
  (backend field/API contract unchanged) - it is simply no longer rendered
  on this page. `ProportionBar` import removed from `ScreenTime.tsx` as it
  has no other use on this page.
- Future Cognitive/Developmental Analysis placeholders (SANGIAN/VWM/DCCS/
  Colour Detection/ASER) are unchanged.
Backend: **131/131 tests pass** (no test asserted the old qualitative diff
labels, so none needed updating). Frontend `tsc --noEmit` and
`npm run build` both succeed. Scope was verified to touch only
`ScreenTime.tsx`, `module_analytics.py`'s difference-bucket constants, and
one new CSS modifier - no REDCap field mapping, Overview, Registry, or
other assessment page was changed.

**Scatter plot fix (2026-09-09, same day):** the "Screen Time vs Physical
Activity" scatter (`frontend/src/components/charts/ScreenActivityScatter.tsx`)
had overlapping/repeating Y-axis text - both axes set a Recharts `unit="
min/day"` (appended to *every* tick, e.g. "40 min/day") **and** a separate
axis-title `label` also saying "(min/day)", so the unit text collided with
the rotated Y-axis title. Fix: removed the `unit` prop from both axes so
ticks render as plain numbers; the single axis-title `label` is the only
place "(min/day)" now appears. Also darkened/regularized the tick and
axis-title text (`var(--text-muted)` → `var(--text-secondary)`, title
weight 600) to match the rest of the page's chart typography - not bold,
just no longer looking faint. Y-axis title/tooltip wording changed from
"Outdoor activity" to "Outdoor play" per this fix's exact wording. No
data, point positions, scale/domain, `n=44`, or chart height/margins
changed - this was a label-rendering fix only. Frontend `tsc --noEmit` and
`npm run build` both succeed; no other DSEQ chart or page touched.

**Weekend − School-Day Difference histogram x-axis label collision fixed
(2026-09-09, same day):** a reported "missing -60 to -30 min bin" turned
out not to be a calculation bug - `module_analytics.py`'s
`_DIFF_MINUTES_BUCKET_EDGES`/`_LABELS` and `bucket_counts()` already
produced all 6 contiguous bins correctly (verified live: counts 1/1/1/29/9/3
summing to `valid_n=44`); the bin was rendering but visually colliding with
its neighbors because `CategoryBarChart`'s default single-line X-axis tick
couldn't fit 6 labels like `"-60 to -30 min"` in this chart's column width,
making one appear to vanish. Fix is frontend-only: `CategoryBarChart.tsx`
gained an **optional** `xTickMaxChars` prop (default unset) - when passed,
X-axis ticks word-wrap via the existing shared `wrapLabel()` helper (same
one `HorizontalBarChart` already uses) into a centered multi-line tick, the
chart's bottom margin/height grow just enough to fit the extra line(s), and
`interval` is forced to 0 so no tick is auto-skipped. Every other
`CategoryBarChart` caller (Demographics, Overview, Physical Activity, and
this page's other three charts using it) omits the prop and is completely
unaffected - same single-line tick, same default height, byte-for-byte
unchanged behavior. Only `ScreenTime.tsx`'s difference-histogram call
passes `xTickMaxChars={9}`. Added a regression test,
`test_difference_distribution_has_six_contiguous_bins_in_order` in
`test_module_analytics.py`, asserting the exact 6 labels/order and that a
value in each bin (including -60 to -30) is counted once and sums to the
input count. Backend: **132/132 tests pass**. Frontend `tsc --noEmit` and
`npm run build` both succeed. No REDCap mapping, calculation, denominator,
or any other DSEQ chart/page changed.

**DSEQ Coding Scores section added (2026-09-10):** a new "DSEQ Coding
Scores" 4-card KPI row was added directly below the Instrument Completion
badge and above "Screen Time Summary" - `build_screen_time_analysis()`'s
existing minutes-based analysis (average/median/school-day/weekend,
weighted 5:2, difference, distribution, age/sex, device, purpose/
supervision/rules distributions, physical activity, scatter, missing-data
logic) is **entirely unchanged**; this is an additive analysis alongside it,
per an approved DSEQ coding specification distinct from the minutes-based
one. Traced against the live `dseq` form's own metadata before
implementing - REDCap's own numeric choice codes on the relevant fields are
already identical to the approved coding scale, so no re-coding is applied,
only reading each field's own stored code:
- **Frequency Score** (range 0-3) - pools every valid response across
  `q1_tv_freq`/`q4_phone_freq`/`q7_laptop_freq` (TV/smartphone/laptop
  weekly-use frequency - confirmed live to share the identical
  Never=0/1-2 days=1/3-5 days=2/6-7 days=3 choice string) into one list and
  reports its `numeric_summary()` - not a per-child average, a pooled
  descriptive statistic across all three same-scale items.
- **Duration Score** (range 0-4) - pools `q2_tv_school`/`q3_tv_holiday`/
  `q5_phone_school`/`q6_phone_holiday` (TV/smartphone school-day+holiday
  duration bands, confirmed identical Does not use/watch=0..>2 hours=4
  choice string). `q11_outdoor_school`/`q12_outdoor_holiday` were
  considered and excluded - they use a *different* 1-4 scale with no
  "Does not use" 0-level and belong to DSEQ Section B (Physical Activity),
  confirmed by the form's own section headers.
- **Supervision Score** (range 0-3) - `q8_supervision` alone (Always=3/
  Often=2/Sometimes=1/Never=0), a single field, so its own
  `numeric_summary()` directly.
- **Household Rules Score** (range 0-1) - `q9_household_rules` alone
  (Yes=1/No=0); the coded-score mean is the proportion of valid respondents
  who answered Yes.
- **No "Yes/No Indicators" card was added** - `q14_school_use` and
  `q15_entertainment_use` are both individually Yes=1/No=0 coded, but
  measure two unrelated constructs (school/homework use vs. entertainment
  use), not two items on one underlying scale; averaging them would produce
  a number with no defensible meaning. This matches the project's own
  existing precedent - `DSEQ_YES_NO_ITEMS` already reports q9/q14/q15 as
  three independent Yes-counts, never one averaged composite. This was
  evaluated and explicitly left out, per instruction not to invent an
  aggregate where none is methodologically defensible - `q14`/`q15` remain
  available individually via the existing `yes_no_items` field.
New constants in `module_analytics.py` (`DSEQ_FREQUENCY_FIELDS`,
`DSEQ_DURATION_FIELDS`, `DSEQ_SUPERVISION_FIELD`,
`DSEQ_HOUSEHOLD_RULES_FIELD`) and a new `_pooled_dseq_coded_score()`
helper; `build_screen_time_analysis()` returns an additional
`coding_scores` dict. New `DseqCodingScores` schema
(`backend/app/schemas/dashboard.py`, reusing the existing `ScoreSummary`
model for each domain - no new per-field schema needed) added to
`ScreenTimeResponse`; wired in `LiveDashboardService.get_screen_time()`.
Frontend: `ScreenTime.tsx` renders the 4 cards using the existing
`KpiCard` component (colored top accent via existing `tone` prop), each
showing the derived value, "Range 0-N", and `n=valid/total (%)` - no
implementation detail, REDCap field name, or long paragraph exposed to
users, matching the polished PAQ-C Key Scores/Dietary Intake visual
language. A new page-scoped CSS rule, `.coding-score-row .kpi-card`
(reuses the existing `--radius-control` token for sharper/subtle corners),
is scoped to only this new row - the existing 6-card "Screen Time Summary"
row below is visually unchanged. Tests: `test_dseq_coding_scores_pooled_and_single_field_domains`
in `test_module_analytics.py` (locks in the field mapping/pooling method
and each domain's denominator) + a `coding_scores` shape assertion added
to the existing `/screen-time` endpoint test. Backend: **143/143 tests
pass**. Frontend `tsc --noEmit` and `npm run build` both succeed.
Live-verified (212 registered, 44/212 DSEQ complete): Frequency mean 0.71
(n=132/636 = 44×3 pooled fields), Duration mean 1.06 (n=176/848 = 44×4),
Supervision mean 1.14 (n=44/212), Household Rules mean 0.52 (n=44/212) -
every completed DSEQ record fully answered every underlying field in each
domain, confirming the pooled denominators are exactly `completed ×
field_count` as designed, not silently diverging from instrument
completion.

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

Backend test count: **143/143 passing** (see the dated sections above for what each batch of new tests covers - most recently the 2026-09-10 DSEQ Coding Scores tests). Frontend `npm run build` succeeds.

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
