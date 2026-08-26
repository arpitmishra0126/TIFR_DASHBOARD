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

The current live project has approximately:

Registered: 212
Core Assessment Battery: 20
SSRS Child after Core Battery: 3
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

## FRONTEND STRUCTURE

Current navigation:

Overview
Participants
Assessment Progress
Demographics & SES

ASSESSMENT MODULES

- Health & Screening
- Physical Activity
- Screen Time
- Neurodevelopment

The sidebar is collapsible.

The dashboard should look like a polished modern clinical/research analytics dashboard, not a Streamlit/admin template.

---

## PAGE RESPONSIBILITIES

### Overview

Study-level summary.

Show:

- Registered
- Core Assessment Battery
- SSRS Child
- SSRS Teacher
- assessment progress/coverage

Do NOT duplicate detailed demographic analysis here.

Do NOT show the large Module Integration Status section on Overview.

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

Backend test count: **82/82 passing** (as of the Excel export refinement pass, 2026-08-26). Frontend `npm run build` succeeds (no frontend changes were needed for either the field-audit expansion or the refinement pass).

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
