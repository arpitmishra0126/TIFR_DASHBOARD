import { useEffect, useMemo, useState } from "react";

import { exportActiveCasesCsv, getChildProfile, getRegistry } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import FullScreenLoader from "../components/FullScreenLoader";
import { IconClose, IconUsers } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import { useRefresh } from "../context/RefreshContext";
import type { ChildProfileResponse, RegistryChild } from "../types/liveDashboard";
import { INSTRUMENT_COLUMNS } from "./Registry";

/** Master Tracker - Phase 1 (2026-11-25), UX refined (2026-11-25)
 *
 * A centralized, child-wise (UID-wise) study tracker: one row per registered
 * child, one column per study instrument, built entirely from data already
 * produced by the existing `/dashboard/registry` endpoint (the same
 * `RegistryChild` shape Registry.tsx and DataQuality.tsx already consume) -
 * no mock data, no fabricated counts.
 *
 * Per-instrument completion status uses the real REDCap "Complete?" field
 * code (0=Incomplete/"not_started", 1=Unverified/"in_progress",
 * 2=Complete/"complete" - RegistryChild.instrument_status_detail) - a
 * genuine tri-state already present in the raw REDCap data, not an invented
 * "in progress" heuristic.
 *
 * The Child Journey panel (opened via "View") is deliberately NOT a second
 * copy of this matrix - it is a compact per-child profile (Growth &
 * Anthropometry, Health History, a Study Journey timeline, file status)
 * built from two existing, already-validated calculation engines
 * (build_anthropometry_analysis's IAP 2015 screening, Child Health History's
 * named-condition/general-flag fields) via the new, narrowly-scoped
 * `/dashboard/child/{id}/profile` endpoint - no duplicated screening logic,
 * no second completion definition. The full instrument status matrix is
 * still available there, but only inside a collapsed "Assessment Status
 * Details" disclosure, so it never dominates the profile view.
 *
 * Explicitly NOT available anywhere in this codebase yet, so shown as a
 * clearly labelled "Pending Integration" placeholder rather than guessed:
 * per-instrument initiation/test dates, AVI/audio-video-interview files
 * (count, name, location, upload date), associated documents, and a
 * Site/Centre field (this project has no such field - only `village`, a
 * different concept, which is therefore not substituted in as a fake
 * Site/Centre). "Pending Integration" means the integration itself does not
 * exist yet - it is never shown as, or counted toward, "Not Started".
 */

const TOTAL_INSTRUMENTS = INSTRUMENT_COLUMNS.length;

type TrackerStatus = "complete" | "in_progress" | "not_started";
type StatusFilter = "all" | TrackerStatus;

function childCounts(child: RegistryChild): { complete: number; inProgress: number } {
  let complete = 0;
  let inProgress = 0;
  for (const col of INSTRUMENT_COLUMNS) {
    const status = child.instrument_status_detail?.[col.key];
    if (status === "complete") complete += 1;
    else if (status === "in_progress") inProgress += 1;
  }
  return { complete, inProgress };
}

function overallState(child: RegistryChild): TrackerStatus {
  const { complete, inProgress } = childCounts(child);
  if (complete >= TOTAL_INSTRUMENTS) return "complete";
  if (complete === 0 && inProgress === 0) return "not_started";
  return "in_progress";
}

function cellStatus(child: RegistryChild, instrumentKey: string): TrackerStatus {
  return child.instrument_status_detail?.[instrumentKey] ?? "not_started";
}

const STATUS_ICON: Record<TrackerStatus, string> = {
  complete: "✓",
  in_progress: "⏱",
  not_started: "✕",
};

const STATUS_LABEL: Record<TrackerStatus, string> = {
  complete: "Done / Completed",
  in_progress: "In Progress / Partial",
  not_started: "Not Done",
};

function StatusCell({ status }: { status: TrackerStatus }) {
  return (
    <span className={`mt-status-dot mt-status-${status}`} title={STATUS_LABEL[status]} aria-label={STATUS_LABEL[status]}>
      {STATUS_ICON[status]}
    </span>
  );
}

function PendingIntegrationBadge({ label = "Pending Integration" }: { label?: string }) {
  return (
    <span className="mt-pending-badge" title="This data source is not yet connected - not the same as a child's incomplete assessment.">
      {label}
    </span>
  );
}

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "complete", label: "Complete" },
  { value: "in_progress", label: "In Progress" },
  { value: "not_started", label: "Not Started" },
];

// Screening results this cohort's IAP 2015 classification can produce for
// each measurement - anything outside "Normal" is a flagged result. Kept as
// a small display-only lookup, not a second classification implementation -
// the actual classification itself is computed once, server-side, by the
// existing Anthropometry module (build_anthropometry_analysis).
const FLAGGED_SCREENING_RESULTS = new Set([
  "Short stature",
  "Low weight-for-age",
  "Thinness",
  "Overweight",
  "Obesity",
]);

function screeningTone(result: string): "flag" | "normal" | "na" {
  if (result === "Not available") return "na";
  if (FLAGGED_SCREENING_RESULTS.has(result)) return "flag";
  return "normal";
}

function screeningStatusText(result: string): string {
  const tone = screeningTone(result);
  if (tone === "na") return "Not assessable";
  if (tone === "flag") return "Screening flag detected";
  return "No supported flag";
}

function formatDate(value: string | null | undefined): string {
  return value ?? "Not Available";
}

/** The "best known" study-activity date for this child, from the only two
 * genuinely dated events this app currently has - registration/visit and
 * the anthropometry assessment. Never fabricated, never falls back to a
 * per-instrument date (none exists). */
function latestRecordedActivity(visitDate: string | null, measurementDate: string | null | undefined): string | null {
  const dates = [visitDate, measurementDate].filter((d): d is string => !!d);
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

function ChildJourneyPanel({ child, onClose }: { child: RegistryChild; onClose: () => void }) {
  const { complete } = childCounts(child);
  const [profile, setProfile] = useState<ChildProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    setProfileError(null);
    getChildProfile(child.redcap_child_id)
      .then(setProfile)
      .catch((err: Error) => setProfileError(err.message));
  }, [child.redcap_child_id]);

  const anthro = profile?.anthropometry ?? null;
  const healthHistory = profile?.health_history ?? null;
  const latestActivity = latestRecordedActivity(child.visit_date, anthro?.measurement_date);

  return (
    <div className="mt-journey-panel table-card">
      <div className="mt-journey-header">
        <h3>Child Journey: {child.redcap_child_id}</h3>
        <div className="mt-journey-header-right">
          <span className="mt-journey-progress-pill">
            Overall Progress: {Math.round((complete / TOTAL_INSTRUMENTS) * 100)}% ({complete}/{TOTAL_INSTRUMENTS})
          </span>
          <button type="button" className="mt-journey-close" onClick={onClose} aria-label="Close child journey">
            <IconClose width={14} height={14} />
          </button>
        </div>
      </div>

      <div className="mt-journey-body mt-journey-body-profile">
        {/* 1. Compact child profile */}
        <dl className="mt-journey-info mt-journey-info-compact">
          <div>
            <dt>UID / Child ID</dt>
            <dd>{child.redcap_child_id}</dd>
          </div>
          <div>
            <dt>Village / Centre</dt>
            <dd>{child.village ?? "Not Available"}</dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{child.age_years !== null ? `${child.age_years} years` : "Not Available"}</dd>
          </div>
          <div>
            <dt>Sex</dt>
            <dd>{child.sex ?? "Not Available"}</dd>
          </div>
          <div>
            <dt>Visit Date</dt>
            <dd>{child.visit_date ?? "Not Available"}</dd>
          </div>
          <div>
            <dt>Current Status</dt>
            <dd>{child.child_status || "Active"}</dd>
          </div>
        </dl>

        {profileError && <DataLoadError message={profileError} onRetry={() => setProfile(null)} />}

        {!profile && !profileError && <p className="mt-journey-loading">Loading profile details…</p>}

        {profile && (
          <>
            {/* 2. Growth & Anthropometry - reuses the Anthropometry module's own
                IAP 2015 screening result for this child, never recomputed here. */}
            <section className="mt-journey-section">
              <h4 className="mt-journey-section-title">Growth &amp; Anthropometry</h4>
              {!anthro ? (
                <p className="mt-journey-unavailable">Data unavailable - this child has no recorded Anthropometry Assessment.</p>
              ) : (
                <>
                  <div className="mt-anthro-stats">
                    <div>
                      <span className="mt-anthro-label">Height</span>
                      <span className="mt-anthro-value">{anthro.height_cm !== null ? `${anthro.height_cm} cm` : "Not Available"}</span>
                    </div>
                    <div>
                      <span className="mt-anthro-label">Weight</span>
                      <span className="mt-anthro-value">{anthro.weight_kg !== null ? `${anthro.weight_kg} kg` : "Not Available"}</span>
                    </div>
                    <div>
                      <span className="mt-anthro-label">BMI</span>
                      <span className="mt-anthro-value">{anthro.bmi !== null ? anthro.bmi.toFixed(1) : "Not Available"}</span>
                    </div>
                    <div>
                      <span className="mt-anthro-label">Measurement Date</span>
                      <span className="mt-anthro-value">{formatDate(anthro.measurement_date)}</span>
                    </div>
                  </div>
                  <table className="data-table mt-screening-table">
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>Screening Result</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Height-for-Age", anthro.height_screening],
                          ["Weight-for-Age", anthro.weight_screening],
                          ["BMI", anthro.bmi_screening],
                        ] as const
                      ).map(([label, result]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>{result === "Not available" ? "—" : result}</td>
                          <td>
                            <span className={`mt-screening-tag mt-screening-tag-${screeningTone(result)}`}>{screeningStatusText(result)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-journey-footnote">
                    Screening indicators only (reference: {anthro.reference_used}) - not a clinical diagnosis.
                  </p>
                </>
              )}
            </section>

            {/* 3. Illness / Health History - compact summary, detail collapsed. */}
            <section className="mt-journey-section">
              <h4 className="mt-journey-section-title">Illness / Health History</h4>
              {healthHistory && healthHistory.completion_status === "not_started" ? (
                <p className="mt-journey-unavailable">Not yet assessed - Child Illness History has not been started for this child.</p>
              ) : healthHistory ? (
                <>
                  <p className="mt-journey-summary-line">
                    {healthHistory.any_named_condition === null && healthHistory.any_general_flag === null
                      ? "Recorded, but no condition items answered yet."
                      : healthHistory.any_named_condition || healthHistory.any_general_flag
                        ? "One or more health conditions/flags recorded - see details below."
                        : "No health conditions recorded."}
                  </p>
                  <DetailDisclosure summary="Assessment Status Details: Recorded health indicators">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Indicator</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...healthHistory.named_conditions, ...healthHistory.general_flags].map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.value || "Not answered"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DetailDisclosure>
                </>
              ) : (
                <p className="mt-journey-unavailable">Data unavailable.</p>
              )}
            </section>

            {/* 4. Study Journey / Timeline - only genuinely dated events. */}
            <section className="mt-journey-section">
              <h4 className="mt-journey-section-title">Study Journey / Timeline</h4>
              <ul className="mt-timeline">
                <li>
                  <span className="mt-timeline-dot" />
                  <span className="mt-timeline-label">Registration / Enrolment</span>
                  <span className="mt-timeline-date">{formatDate(child.visit_date)}</span>
                </li>
                <li>
                  <span className="mt-timeline-dot" />
                  <span className="mt-timeline-label">Anthropometry Assessment</span>
                  <span className="mt-timeline-date">{formatDate(anthro?.measurement_date)}</span>
                </li>
                <li>
                  <span className="mt-timeline-dot" />
                  <span className="mt-timeline-label">Latest Recorded Study Activity</span>
                  <span className="mt-timeline-date">{formatDate(latestActivity)}</span>
                </li>
                <li>
                  <span className="mt-timeline-dot mt-timeline-dot-pending" />
                  <span className="mt-timeline-label">AVI / Video Interview Files</span>
                  <span className="mt-timeline-date">
                    <PendingIntegrationBadge />
                  </span>
                </li>
                <li>
                  <span className="mt-timeline-dot mt-timeline-dot-pending" />
                  <span className="mt-timeline-label">Associated Documents / Files</span>
                  <span className="mt-timeline-date">
                    <PendingIntegrationBadge />
                  </span>
                </li>
              </ul>
            </section>
          </>
        )}

        {/* 5. Collapsed, non-dominant Assessment Status Details - the full
            per-instrument matrix is already on the Master Tracker table;
            this is a reference copy only, for this one child. */}
        <DetailDisclosure summary="Assessment Status Details (per-instrument status)">
          <table className="data-table mt-journey-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Test / Assessment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUMENT_COLUMNS.map((col, idx) => {
                const status = cellStatus(child, col.key);
                return (
                  <tr key={col.key}>
                    <td>{idx + 1}</td>
                    <td>{col.label}</td>
                    <td>
                      <StatusCell status={status} /> {STATUS_LABEL[status]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DetailDisclosure>
      </div>
    </div>
  );
}

export default function MasterTracker() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRegistry>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version, lastUpdated } = useRefresh();

  const [search, setSearch] = useState("");
  const [testFilter, setTestFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    // Fetch the full registered cohort in one page (same limit=500
    // "whole cohort, client-side filtering" precedent already used by the
    // Data Quality page for the same underlying endpoint) - this study's
    // cohort size is well under 500.
    getRegistry({ limit: 500 })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  const children = data?.children ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return children.filter((child) => {
      if (needle && !child.redcap_child_id.toLowerCase().includes(needle)) return false;
      if (statusFilter !== "all") {
        const status = testFilter === "all" ? overallState(child) : cellStatus(child, testFilter);
        if (status !== statusFilter) return false;
      }
      return true;
    });
  }, [children, search, testFilter, statusFilter]);

  const summary = useMemo(() => {
    let fullyCompleted = 0;
    let notStarted = 0;
    for (const child of children) {
      const state = overallState(child);
      if (state === "complete") fullyCompleted += 1;
      else if (state === "not_started") notStarted += 1;
    }
    const total = children.length;
    const inProgress = total - fullyCompleted - notStarted;
    return { total, fullyCompleted, inProgress, notStarted };
  }, [children]);

  const selectedChild = children.find((c) => c.redcap_child_id === selectedChildId) ?? null;

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await exportActiveCasesCsv();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading Master Tracker..." />;

  return (
    <section className="master-tracker-page">
      <PageHeader
        eyebrow="Study-Wide Tracking"
        title="Master Tracker"
        subtitle="Child-wise study journey, test completion and file tracking"
        right={
          <div className="mt-header-actions">
            {lastUpdated && (
              <span className="mt-last-synced">
                Last Synced: {lastUpdated.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button type="button" className="export-button" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Exporting…" : "Export (CSV)"}
            </button>
          </div>
        }
      />
      {exportError && <p className="refresh-error">Export failed: {exportError}</p>}

      <div className="kpi-row mt-summary-row">
        <KpiCard label="Total Children" value={summary.total} icon={IconUsers} tone="blue" />
        <KpiCard
          label="Fully Completed"
          value={summary.fullyCompleted}
          sublabel={`${summary.total ? Math.round((summary.fullyCompleted / summary.total) * 100) : 0}%`}
          tone="aqua"
        />
        <KpiCard
          label="In Progress"
          value={summary.inProgress}
          sublabel={`${summary.total ? Math.round((summary.inProgress / summary.total) * 100) : 0}%`}
          tone="amber"
        />
        <KpiCard
          label="Not Started"
          value={summary.notStarted}
          sublabel={`${summary.total ? Math.round((summary.notStarted / summary.total) * 100) : 0}%`}
          tone="neutral"
        />
      </div>

      <div className="ats-pstatus-controls mt-filter-row">
        <input
          type="text"
          className="ats-pstatus-search"
          placeholder="Search by UID / Child ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search by UID / Child ID"
        />
        <select className="ats-pstatus-select" value={testFilter} onChange={(e) => setTestFilter(e.target.value)} aria-label="Test / Assessment">
          <option value="all">All Tests</option>
          {INSTRUMENT_COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
        <select
          className="ats-pstatus-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Status"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Site/Centre filter intentionally omitted - this project's REDCap
            data has no Site/Centre field (only `village`, a different,
            already-filterable concept elsewhere in the app). Do not
            substitute village in as a fake Site/Centre filter here. */}
        <button
          type="button"
          className="filter-bar-reset"
          disabled={!search && testFilter === "all" && statusFilter === "all"}
          onClick={() => {
            setSearch("");
            setTestFilter("all");
            setStatusFilter("all");
          }}
        >
          Reset
        </button>
      </div>

      <p className="mt-result-count">
        {filtered.length} of {children.length} children shown
      </p>

      <div className="mt-table-wrap table-card">
        <table className="data-table mt-tracker-table">
          <thead>
            <tr>
              <th>UID / Child ID</th>
              <th>Overall Progress</th>
              {INSTRUMENT_COLUMNS.map((col) => (
                <th key={col.key} title={col.label}>
                  {col.short}
                </th>
              ))}
              <th>AVI Files</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((child) => {
              const { complete } = childCounts(child);
              return (
                <tr key={child.redcap_child_id} className={child.redcap_child_id === selectedChildId ? "mt-row-selected" : undefined}>
                  <td>
                    <button type="button" className="mt-child-link" onClick={() => setSelectedChildId(child.redcap_child_id)}>
                      {child.redcap_child_id}
                    </button>
                  </td>
                  <td className="mt-progress-cell">
                    <div className="mt-progress-text">
                      {Math.round((complete / TOTAL_INSTRUMENTS) * 100)}% ({complete}/{TOTAL_INSTRUMENTS})
                    </div>
                    <ProportionBar value={complete} total={TOTAL_INSTRUMENTS} />
                  </td>
                  {INSTRUMENT_COLUMNS.map((col) => (
                    <td key={col.key} className="mt-status-td">
                      <StatusCell status={cellStatus(child, col.key)} />
                    </td>
                  ))}
                  <td>
                    <PendingIntegrationBadge label="—" />
                  </td>
                  <td>
                    <button type="button" className="mt-view-button" onClick={() => setSelectedChildId(child.redcap_child_id)}>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={INSTRUMENT_COLUMNS.length + 4} className="mt-empty-row">
                  No children match the current search/filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-legend">
        <span>
          <StatusCell status="complete" /> Done / Completed
        </span>
        <span>
          <StatusCell status="in_progress" /> In Progress / Partial
        </span>
        <span>
          <StatusCell status="not_started" /> Not Done
        </span>
        <span>
          <span className="mt-pending-badge">Pending Integration</span> Data source not yet connected
        </span>
      </div>

      {selectedChild && <ChildJourneyPanel child={selectedChild} onClose={() => setSelectedChildId(null)} />}
    </section>
  );
}
