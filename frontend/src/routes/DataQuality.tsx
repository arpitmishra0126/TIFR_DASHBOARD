import { useEffect, useRef, useState } from "react";

import { getAssessmentToolStatus, getRegistry } from "../api/dashboard";
import { percentOf } from "../components/charts/chartHelpers";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import { STUDY_DECEASED_COUNT, STUDY_MIGRATED_COUNT, STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import type { AssessmentToolParticipantStatus, RegistryChild } from "../types/liveDashboard";
import { INSTRUMENT_COLUMNS } from "./Registry";

/** This page answers "what is wrong with the current data, how many records
 * are affected, which IDs, and what needs review" - it is a QC/governance
 * view, not a second analytics dashboard. Every figure below is derived
 * client-side from data the existing `/dashboard/registry` (limit=500, i.e.
 * every registered child in one page - same pattern already used by
 * Overview's Core Assessment Completion drawer) and
 * `/dashboard/assessment-tool-status` endpoints already return - no new
 * backend endpoint or REDCap field was added. Where a requested check has no
 * backing field (malformed-ID convention, per-record migrated/deceased
 * status, a second form date to compare visit_date against, the assessor-
 * decision field), it is shown as "Not currently available" rather than
 * guessed - see the `NOT_AVAILABLE_*` constants below. */

// The 6 Core Assessment Battery instruments - same keys/order as the
// backend's CORE_BATTERY_INSTRUMENTS (live_field_map.py) and the identical
// list already used by Overview's Core Assessment Completion drill-down.
const CORE_BATTERY_KEYS = ["ses", "dseq", "child_illness_history", "paq_a", "dietary_intake", "ssrs_parent"];

// All 11 study instruments shown in the Instrument Completeness section -
// "registration" reads RegistryChild.registration_complete directly; the
// other 10 reuse Registry's own INSTRUMENT_COLUMNS (imported, not copied),
// so this page can never disagree with the Participants table about what
// an instrument is called or which key drives it.
const DATA_QUALITY_INSTRUMENTS: { key: string; label: string }[] = [
  { key: "registration", label: "Registration" },
  ...INSTRUMENT_COLUMNS.map((col) => ({ key: col.key, label: col.key === "ses" ? "SES (Screening)" : col.label })),
];

interface CriticalField {
  key: string;
  label: string;
  present: (c: RegistryChild) => boolean;
}

const CRITICAL_FIELDS: CriticalField[] = [
  { key: "record_id", label: "Record ID", present: (c) => !!c.redcap_child_id && c.redcap_child_id.trim() !== "" },
  { key: "child_status", label: "Child Status", present: (c) => !!c.child_status && c.child_status.trim() !== "" },
  { key: "sex", label: "Sex", present: (c) => !!c.sex },
  { key: "age", label: "DOB / Age", present: (c) => !!c.dob || c.age_years !== null },
  { key: "visit_date", label: "Visit Date", present: (c) => !!c.visit_date },
];

interface QualityIssue {
  id: string;
  checkKey: string;
  form: string;
  issue: string;
}

const CHECK_DEFINITIONS: { key: string; label: string }[] = [
  { key: "duplicate_id", label: "Duplicate Record ID" },
  { key: "missing_id", label: "Missing Record ID" },
  { key: "critical_field_missing", label: "Missing Critical Field" },
  { key: "core_battery_mismatch", label: "Core Battery Consistency" },
  { key: "ats_mismatch", label: "Assessment Tool Status Consistency" },
  { key: "registered_no_data", label: "Registered - No Downstream Data" },
  { key: "visit_date_missing", label: "Visit Date Missing" },
  { key: "visit_date_future", label: "Future-Dated Visit Date" },
];
const CHECK_LABEL: Record<string, string> = Object.fromEntries(CHECK_DEFINITIONS.map((c) => [c.key, c.label]));

const ATS_TESTS: { key: "sangian" | "vwm" | "dccs" | "cd"; label: string }[] = [
  { key: "sangian", label: "SANGIAN" },
  { key: "vwm", label: "VWM" },
  { key: "dccs", label: "DCCS" },
  { key: "cd", label: "CD" },
];

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Thin sharp progress line - same visual language as the redesigned
 * Overview page, reusing the existing global `.monitor-bar*` CSS classes
 * (defined once in app.css, not scoped to any one route). */
function Bar({ percent, tone = "blue" }: { percent: number; tone?: "blue" | "teal" | "violet" | "amber" }) {
  return (
    <div className={`monitor-bar monitor-bar-tone-${tone}`}>
      <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

function Row({
  label,
  valueText,
  percent,
  tone = "blue",
  selected,
  onSelect,
}: {
  label: string;
  valueText: string;
  percent?: number;
  tone?: "blue" | "teal" | "violet" | "amber";
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button type="button" className={`monitor-row${selected ? " monitor-row-selected" : ""}`} onClick={onSelect} disabled={!onSelect}>
      <span className="monitor-row-label">{label}</span>
      <span className="monitor-row-value">{valueText}</span>
      {percent !== undefined && <Bar percent={percent} tone={tone} />}
    </button>
  );
}

/** Compact bordered id-chip list - the "pending" viewer for the Instrument
 * Completeness section (participants who have not yet completed an
 * instrument - an expected workflow state, not a quality issue, so it is
 * deliberately kept separate from the Issues Requiring Review table). */
function IdChipList({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return <p className="monitor-detail-empty">No affected records.</p>;
  }
  return (
    <div className="dq-id-list">
      {ids.map((id) => (
        <span className="dq-id-chip" key={id}>
          {id}
        </span>
      ))}
    </div>
  );
}

export default function DataQuality() {
  const [children, setChildren] = useState<RegistryChild[] | null>(null);
  const [atsRows, setAtsRows] = useState<AssessmentToolParticipantStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedInstrument, setSelectedInstrument] = useState(DATA_QUALITY_INSTRUMENTS[0].key);
  const [issueQuery, setIssueQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState("all");
  const { version } = useRefresh();
  const issuesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([getRegistry({ limit: 500 }), getAssessmentToolStatus()])
      .then(([registry, ats]) => {
        setChildren(registry.children);
        setAtsRows(ats.participant_statuses);
      })
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  const focusIssue = (checkKey: string) => {
    setIssueFilter(checkKey);
    setIssueQuery("");
    issuesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!children || !atsRows) return <FullScreenLoader message="Loading Data Quality..." />;

  const total = children.length;

  // --- 2. Record / ID integrity ---------------------------------------
  const idCounts = new Map<string, number>();
  for (const c of children) {
    const id = c.redcap_child_id?.trim();
    if (!id) continue;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const uniqueIds = idCounts.size;
  const missingIdChildren = children.filter((c) => !c.redcap_child_id || c.redcap_child_id.trim() === "");
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);
  const duplicateChildren = children.filter((c) => duplicateIds.some(([id]) => id === c.redcap_child_id));

  const reconciledTotal = STUDY_ORIGINAL_ENROLLMENT - STUDY_MIGRATED_COUNT - STUDY_DECEASED_COUNT;
  const reconciliationConsistent = reconciledTotal === total;

  // --- 3. Instrument completeness ---------------------------------------
  const instrumentStats = DATA_QUALITY_INSTRUMENTS.map((inst) => {
    const isComplete = (c: RegistryChild) => (inst.key === "registration" ? c.registration_complete : c.instrument_status[inst.key]);
    const completed = children.filter(isComplete).length;
    const incompleteIds = children.filter((c) => !isComplete(c)).map((c) => c.redcap_child_id);
    return { ...inst, completed, percent: percentOf(completed, total), incompleteIds };
  });
  const overallInstrumentCompletionPercent = percentOf(
    instrumentStats.reduce((sum, i) => sum + i.completed, 0),
    instrumentStats.length * total,
  );
  const selectedInstrumentStat = instrumentStats.find((i) => i.key === selectedInstrument) ?? instrumentStats[0];

  // --- 4. Critical field completeness ------------------------------------
  const criticalFieldStats = CRITICAL_FIELDS.map((field) => {
    const missingIds = children.filter((c) => !field.present(c)).map((c) => c.redcap_child_id);
    return { ...field, missingCount: missingIds.length, missingIds, percent: percentOf(total - missingIds.length, total) };
  });
  const childrenWithAllCritical = children.filter((c) => CRITICAL_FIELDS.every((f) => f.present(c))).length;
  const criticalCompletenessPercent = percentOf(childrenWithAllCritical, total);

  // --- Build the master issues list --------------------------------------
  const issues: QualityIssue[] = [];

  for (const c of duplicateChildren) {
    issues.push({ id: c.redcap_child_id, checkKey: "duplicate_id", form: "Registration", issue: "Record ID appears more than once" });
  }
  for (const c of missingIdChildren) {
    issues.push({ id: c.redcap_child_id || "(blank)", checkKey: "missing_id", form: "Registration", issue: "Record ID is blank" });
  }
  for (const field of criticalFieldStats) {
    if (field.key === "record_id") continue; // already covered by missing_id above
    for (const id of field.missingIds) {
      issues.push({ id, checkKey: "critical_field_missing", form: "Registration", issue: `Missing ${field.label}` });
    }
  }

  // Core battery consistency: recompute the same definition backend already
  // uses (all 6 core instruments complete) and compare against the stored
  // `core_battery_complete` flag - flags a serialization/drift bug, never a
  // second definition of "core battery complete."
  let coreBatteryMismatchCount = 0;
  for (const c of children) {
    const recomputed = CORE_BATTERY_KEYS.every((k) => c.instrument_status[k]);
    if (recomputed !== c.core_battery_complete) {
      coreBatteryMismatchCount += 1;
      issues.push({
        id: c.redcap_child_id,
        checkKey: "core_battery_mismatch",
        form: "Core Assessment Battery",
        issue: `Stored flag (${c.core_battery_complete ? "complete" : "incomplete"}) does not match the 6 underlying instruments (${recomputed ? "complete" : "incomplete"})`,
      });
    }
  }

  // Assessment Tool Status consistency: RegistryChild.assessment_tool_status_detail
  // (done/not_done/not_answered per test) is computed by a different backend
  // helper than the assessment-tool-status endpoint's participant_statuses
  // booleans - both are meant to apply the identical "done" predicate, so
  // any disagreement between them is a genuine drift to review.
  const atsByChildId = new Map(atsRows.map((r) => [r.child_id, r]));
  let atsMismatchCount = 0;
  for (const c of children) {
    const participantRow = atsByChildId.get(c.redcap_child_id);
    if (!participantRow) continue;
    for (const test of ATS_TESTS) {
      const detail = c.assessment_tool_status_detail[test.key];
      if (detail === undefined) continue;
      const expectedDone = detail === "done";
      if (participantRow[test.key] !== expectedDone) {
        atsMismatchCount += 1;
        issues.push({
          id: c.redcap_child_id,
          checkKey: "ats_mismatch",
          form: "Assessment Tool Status",
          issue: `${test.label} status inconsistent between Registry detail (${detail}) and participant-level status`,
        });
      }
    }
  }

  // Registered with a recorded visit but zero downstream instrument data -
  // a visit occurred (visit_date present) yet nothing was collected, which
  // is a more meaningful signal than "hasn't started yet" (blank visit_date).
  const registeredNoDataChildren = children.filter(
    (c) => c.registration_complete && !!c.visit_date && !Object.values(c.instrument_status).some(Boolean),
  );
  for (const c of registeredNoDataChildren) {
    issues.push({
      id: c.redcap_child_id,
      checkKey: "registered_no_data",
      form: "Registration",
      issue: "Visit date recorded but no instrument data completed",
    });
  }

  // Visit date missing despite recorded instrument completion.
  const visitDateMissingChildren = children.filter((c) => !c.visit_date && Object.values(c.instrument_status).some(Boolean));
  for (const c of visitDateMissingChildren) {
    issues.push({
      id: c.redcap_child_id,
      checkKey: "visit_date_missing",
      form: "Registration",
      issue: "Visit date missing despite recorded instrument completion",
    });
  }

  // Future-dated visit date.
  const today = todayMidnight();
  const visitDateFutureChildren = children.filter((c) => c.visit_date && new Date(c.visit_date) > today);
  for (const c of visitDateFutureChildren) {
    issues.push({ id: c.redcap_child_id, checkKey: "visit_date_future", form: "Registration", issue: `Visit date (${c.visit_date}) is in the future` });
  }

  const filteredIssues = issues.filter((i) => {
    if (issueFilter !== "all" && i.checkKey !== issueFilter) return false;
    if (issueQuery && !i.id.toLowerCase().includes(issueQuery.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <section className="overview-page">
      <PageHeader eyebrow="Data Governance" title="Data Quality" subtitle="Live REDCap data integrity & quality monitoring" />

      <div className="stat-strip">
        <div className="stat-block">
          <span className="stat-block-label">Records</span>
          <span className="stat-block-value">{total.toLocaleString()}</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Critical Field Completeness</span>
          <span className="stat-block-value">{criticalCompletenessPercent}%</span>
          <span className="stat-block-footnote">{childrenWithAllCritical}/{total} complete</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Instrument Completeness</span>
          <span className="stat-block-value">{overallInstrumentCompletionPercent}%</span>
          <span className="stat-block-footnote">Across all 11 instruments</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Issues Requiring Review</span>
          <span className="stat-block-value">{issues.length.toLocaleString()}</span>
        </div>
      </div>

      {/* --- 2. Record / ID integrity --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Record &amp; ID Integrity</span>
          <span className="monitor-section-note">All {total} registered records</span>
        </div>
        <Row label="Total Records" valueText={total.toLocaleString()} />
        <Row label="Unique Record IDs" valueText={uniqueIds.toLocaleString()} />
        <Row
          label="Duplicate Record IDs"
          valueText={duplicateChildren.length.toLocaleString()}
          onSelect={duplicateChildren.length > 0 ? () => focusIssue("duplicate_id") : undefined}
        />
        <Row
          label="Missing / Blank Record IDs"
          valueText={missingIdChildren.length.toLocaleString()}
          onSelect={missingIdChildren.length > 0 ? () => focusIssue("missing_id") : undefined}
        />
        <div className="monitor-row monitor-row-static">
          <span className="monitor-row-label">Malformed / Unexpected Record IDs</span>
          <span className="monitor-row-value monitor-row-value-muted">Not currently available - no documented ID format rule</span>
        </div>

        <div className="monitor-subgroup-label">Cohort Reconciliation</div>
        <div className="dq-reconciliation">
          <span>
            Original cohort <strong>{STUDY_ORIGINAL_ENROLLMENT}</strong> - {STUDY_MIGRATED_COUNT} migrated - {STUDY_DECEASED_COUNT} deceased ={" "}
            <strong>{reconciledTotal}</strong> · Current analytical population <strong>{total}</strong>
          </span>
          <StatusBadge label={reconciliationConsistent ? "Consistent" : "Inconsistent"} tone={reconciliationConsistent ? "good" : "critical"} />
        </div>
      </div>

      {/* --- 3. Instrument completeness --- */}
      <div className="monitor-layout">
        <div className="monitor-main">
          <div className="monitor-section">
            <div className="monitor-section-head">
              <span className="monitor-section-title">Instrument Completeness</span>
              <span className="monitor-section-note">Select an instrument to view pending Record IDs</span>
            </div>
            {instrumentStats.map((inst) => (
              <Row
                key={inst.key}
                label={inst.label}
                valueText={`${inst.completed}/${total} (${inst.percent}%)`}
                percent={inst.percent}
                selected={selectedInstrument === inst.key}
                onSelect={() => setSelectedInstrument(inst.key)}
              />
            ))}
          </div>
        </div>
        <div className="monitor-detail">
          <div className="monitor-detail-panel">
            <div className="monitor-detail-title">{selectedInstrumentStat.label}</div>
            <div className="monitor-detail-subtitle">
              Pending: {selectedInstrumentStat.incompleteIds.length}/{total}
            </div>
            <div className="dq-id-scroll">
              <IdChipList ids={selectedInstrumentStat.incompleteIds} />
            </div>
          </div>
        </div>
      </div>

      {/* --- 4. Critical field completeness --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Critical Field Completeness</span>
          <span className="monitor-section-note">Fields already used elsewhere in the dashboard/study workflow</span>
        </div>
        {criticalFieldStats.map((field) => (
          <Row
            key={field.key}
            label={field.label}
            valueText={`${field.missingCount} missing (${field.percent}% complete)`}
            percent={field.percent}
            onSelect={field.key !== "record_id" && field.missingCount > 0 ? () => focusIssue("critical_field_missing") : undefined}
          />
        ))}
        <div className="monitor-row monitor-row-static">
          <span className="monitor-row-label">Assessment Decision / Readiness Field</span>
          <span className="monitor-row-value monitor-row-value-muted">Not currently available - not exposed per-participant yet</span>
        </div>
      </div>

      {/* --- 5. Cross-form consistency --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Cross-Form Consistency</span>
          <span className="monitor-section-note">CHECK · STATUS · ISSUES</span>
        </div>
        <div className="dq-check-table">
          <div className="dq-check-row" onClick={() => focusIssue("core_battery_mismatch")}>
            <span className="dq-check-name">Core Battery flag matches underlying instruments</span>
            <StatusBadge label={coreBatteryMismatchCount === 0 ? "Pass" : "Issues"} tone={coreBatteryMismatchCount === 0 ? "good" : "critical"} />
            <span className="dq-check-count">{coreBatteryMismatchCount}</span>
          </div>
          <div className="dq-check-row" onClick={() => focusIssue("ats_mismatch")}>
            <span className="dq-check-name">Assessment Tool Status matches participant-level status</span>
            <StatusBadge label={atsMismatchCount === 0 ? "Pass" : "Issues"} tone={atsMismatchCount === 0 ? "good" : "critical"} />
            <span className="dq-check-count">{atsMismatchCount}</span>
          </div>
          <div className="dq-check-row" onClick={() => focusIssue("registered_no_data")}>
            <span className="dq-check-name">Registered with a recorded visit but no instrument data</span>
            <StatusBadge label={registeredNoDataChildren.length === 0 ? "Pass" : "Issues"} tone={registeredNoDataChildren.length === 0 ? "good" : "warning"} />
            <span className="dq-check-count">{registeredNoDataChildren.length}</span>
          </div>
          <div className="dq-check-row dq-check-row-static">
            <span className="dq-check-name">Migrated/deceased participant appearing in active population</span>
            <StatusBadge label="Not available" tone="neutral" />
            <span className="dq-check-count">—</span>
          </div>
        </div>
      </div>

      {/* --- 6. Date / timeline QC --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Date / Timeline QC</span>
          <span className="monitor-section-note">Only `visit_date` is exposed for this population</span>
        </div>
        <div className="dq-check-table">
          <div className="dq-check-row" onClick={() => focusIssue("visit_date_missing")}>
            <span className="dq-check-name">Visit date missing despite recorded instrument completion</span>
            <StatusBadge label={visitDateMissingChildren.length === 0 ? "Pass" : "Issues"} tone={visitDateMissingChildren.length === 0 ? "good" : "warning"} />
            <span className="dq-check-count">{visitDateMissingChildren.length}</span>
          </div>
          <div className="dq-check-row" onClick={() => focusIssue("visit_date_future")}>
            <span className="dq-check-name">Visit date is in the future</span>
            <StatusBadge label={visitDateFutureChildren.length === 0 ? "Pass" : "Issues"} tone={visitDateFutureChildren.length === 0 ? "good" : "critical"} />
            <span className="dq-check-count">{visitDateFutureChildren.length}</span>
          </div>
          <div className="dq-check-row dq-check-row-static">
            <span className="dq-check-name">Assessment date before registration date</span>
            <StatusBadge label="Not available" tone="neutral" />
            <span className="dq-check-count">—</span>
          </div>
          <div className="dq-check-row dq-check-row-static">
            <span className="dq-check-name">Chronology across multiple form dates</span>
            <StatusBadge label="Not available" tone="neutral" />
            <span className="dq-check-count">—</span>
          </div>
        </div>
      </div>

      {/* --- 7. Assessment QC --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Assessment QC</span>
          <span className="monitor-section-note">Administration status only - same definitions as Assessment Progress</span>
        </div>
        {ATS_TESTS.map((test) => {
          const done = atsRows.filter((r) => r[test.key]).length;
          return <Row key={test.key} label={test.label} valueText={`${done}/${atsRows.length}`} percent={percentOf(done, atsRows.length)} />;
        })}
        <p className="monitor-section-footnote">
          Consistency between this status and the underlying per-field completion data is checked under Cross-Form Consistency above.
        </p>
      </div>

      {/* --- 8. Issues requiring review --- */}
      <div className="monitor-section" ref={issuesRef}>
        <div className="monitor-section-head">
          <span className="monitor-section-title">Issues Requiring Review</span>
          <span className="monitor-section-note">{filteredIssues.length} of {issues.length} shown</span>
        </div>
        <div className="dq-issue-controls">
          <input
            type="text"
            className="ats-pstatus-search"
            placeholder="Search Record ID"
            value={issueQuery}
            onChange={(e) => setIssueQuery(e.target.value)}
            aria-label="Search Record ID"
          />
          <select
            className="ats-pstatus-filter"
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            aria-label="Filter by check"
          >
            <option value="all">All checks</option>
            {CHECK_DEFINITIONS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ats-pstatus-table-wrap">
          <table className="ats-pstatus-table dq-issue-table">
            <thead>
              <tr>
                <th className="ats-pstatus-id-col">Record ID</th>
                <th>Check</th>
                <th>Form</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue, idx) => (
                <tr key={`${issue.id}-${issue.checkKey}-${idx}`}>
                  <td className="ats-pstatus-id-cell">{issue.id}</td>
                  <td>{CHECK_LABEL[issue.checkKey]}</td>
                  <td>{issue.form}</td>
                  <td>{issue.issue}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredIssues.length === 0 && <p className="ats-pstatus-empty">No issues match this search/filter.</p>}
        </div>
      </div>
    </section>
  );
}
