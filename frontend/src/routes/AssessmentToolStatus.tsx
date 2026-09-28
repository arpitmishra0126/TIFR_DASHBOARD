import { useEffect, useMemo, useState } from "react";

import { getAssessmentToolStatus } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import { IconChevron } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type { AssessmentDomainStatus, AssessmentToolParticipantStatus, AssessmentToolStatusResponse } from "../types/liveDashboard";

type AtsToolKey = "sangian" | "vwm" | "dccs" | "cd";
const ATS_TOOL_COLUMNS: { key: AtsToolKey; label: string }[] = [
  { key: "sangian", label: "SANGIAN" },
  { key: "vwm", label: "VWM" },
  { key: "dccs", label: "DCCS" },
  { key: "cd", label: "CD" },
];

type AtsCompletionFilter = "all" | "4" | "3" | "2" | "1" | "0";
const ATS_COMPLETION_FILTERS: { value: AtsCompletionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "4", label: "4/4 Complete" },
  { value: "3", label: "3/4 Complete" },
  { value: "2", label: "2/4 Complete" },
  { value: "1", label: "1/4 Complete" },
  { value: "0", label: "0/4 Complete" },
];

/** Count of the four tools marked Done for one participant row - a pure
 * re-derivation from the row's own booleans (themselves the identical
 * predicate behind the existing *_participant aggregates), never a second
 * completion definition. */
function atsDoneCount(row: AssessmentToolParticipantStatus): number {
  return ATS_TOOL_COLUMNS.reduce((sum, col) => sum + (row[col.key] ? 1 : 0), 0);
}

function atsStatusText(row: AssessmentToolParticipantStatus): string {
  const doneCount = atsDoneCount(row);
  if (doneCount === 4) return "4/4 Complete";
  const pending = ATS_TOOL_COLUMNS.filter((col) => !row[col.key]).map((col) => col.label);
  return `${doneCount}/4 Complete — Pending: ${pending.join(", ")}`;
}

/** Compact "Participant Assessment Status" mini-section - collapsed by
 * default, search + completion-count filter + a Child ID/SANGIAN/VWM/DCCS/
 * CD/Status table over the whole registered cohort. Every value is read
 * directly from the existing per-participant done booleans - no new
 * completion definition, no recalculation.
 *
 * Relocated here from Overview.tsx (2026-09-28 Dashboard-as-hub redesign) -
 * this is the detailed participant-level drilldown, so it belongs on this
 * dedicated Assessment Tool Status page, not on the Dashboard. Behavior is
 * unchanged, just self-contained (own `expanded` state) rather than
 * controlled by a parent Quick Action. */
function ParticipantAssessmentStatusPanel({ status }: { status: AssessmentToolStatusResponse }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AtsCompletionFilter>("all");
  const [commonOnly, setCommonOnly] = useState(false);

  const commonIdSet = useMemo(() => new Set(status.common_participant_ids), [status.common_participant_ids]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return status.participant_statuses.filter((row) => {
      if (commonOnly && !commonIdSet.has(row.child_id)) return false;
      if (q && !row.child_id.toLowerCase().includes(q)) return false;
      if (filter !== "all" && atsDoneCount(row) !== Number(filter)) return false;
      return true;
    });
  }, [status.participant_statuses, query, filter, commonOnly, commonIdSet]);

  return (
    <div className="ats-pstatus">
      <button type="button" className="ats-common-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <IconChevron width={11} height={11} className={`ats-common-toggle-chevron${expanded ? " ats-common-toggle-chevron-open" : ""}`} />
        <span>View Participant Assessment Status</span>
      </button>

      {expanded && (
        <div className="ats-pstatus-panel">
          <div className="ats-pstatus-controls">
            <input
              type="text"
              className="ats-pstatus-search"
              placeholder="Search Child ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search Child ID"
            />
            <select
              className="ats-pstatus-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as AtsCompletionFilter)}
              aria-label="Filter by completion status"
            >
              {ATS_COMPLETION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`ats-pstatus-common-toggle${commonOnly ? " ats-pstatus-common-toggle-active" : ""}`}
              onClick={() => setCommonOnly((v) => !v)}
              aria-pressed={commonOnly}
            >
              Common Participants · {status.common_participant_ids.length}
            </button>
          </div>

          <div className="ats-pstatus-table-wrap">
            <table className="ats-pstatus-table">
              <colgroup>
                <col className="ats-pstatus-id-col" />
                {ATS_TOOL_COLUMNS.map((col) => (
                  <col key={col.key} className="ats-pstatus-tool-col" />
                ))}
                <col className="ats-pstatus-status-col" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ats-pstatus-id-col">Child ID</th>
                  {ATS_TOOL_COLUMNS.map((col) => (
                    <th key={col.key} className="ats-pstatus-tool-col">
                      {col.label}
                    </th>
                  ))}
                  <th className="ats-pstatus-status-col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.child_id}>
                    <td className="ats-pstatus-id-cell">{row.child_id}</td>
                    {ATS_TOOL_COLUMNS.map((col) => (
                      <td key={col.key} className={`ats-pstatus-tool-col ${row[col.key] ? "ats-pstatus-done" : "ats-pstatus-not-done"}`}>
                        <span className="ats-pstatus-mark">{row[col.key] ? "✓" : "—"}</span>
                      </td>
                    ))}
                    <td className="ats-pstatus-status-cell">{atsStatusText(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && <p className="ats-pstatus-empty">No participants match this search/filter.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function domainValue(domain: AssessmentDomainStatus): string {
  return domain.mean_done !== null ? `${domain.mean_done}/${domain.field_count}` : "-";
}

function domainSublabel(domain: AssessmentDomainStatus): string {
  if (domain.valid_n === 0) return `No data (0/${domain.total})`;
  return `${domain.completion_percent}% avg completion · n=${domain.valid_n}/${domain.total} (${domain.percent_valid}%)`;
}

export default function AssessmentToolStatus() {
  const [data, setData] = useState<AssessmentToolStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getAssessmentToolStatus()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading Assessment Tool Status..." />;

  const { completion } = data;

  return (
    <section className="assessment-tool-status-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Assessment Tool Status"
        subtitle="Administration status (Done / Not Done) for the SANGIAN and VWM-related tools - live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader title="Assessment Tool Status" note="Mean tools marked Done per child · not a validated outcome score" />
      <div className="kpi-row">
        <KpiCard label="SANGIAN Assessment Status" value={domainValue(data.sangian)} sublabel={domainSublabel(data.sangian)} tone="blue" />
        <KpiCard label="VWM & Related Tasks Status" value={domainValue(data.vwm)} sublabel={domainSublabel(data.vwm)} tone="violet" />
        <KpiCard label="Overall Assessment Tool Status" value={domainValue(data.overall)} sublabel={domainSublabel(data.overall)} tone="aqua" />
      </div>

      <SectionHeader
        title="Assessment Breakdown"
        note="Valid N = children who answered that specific assessment - blank responses are excluded, never counted as Not Done"
      />
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Done</th>
              <th>Not Done</th>
              <th>Valid N</th>
              <th>Completion %</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td className="assessment-tool-done-cell">{item.done_count}</td>
                <td className="assessment-tool-not-done-cell">{item.not_done_count}</td>
                <td>{item.valid_n}</td>
                <td>{item.completion_percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader
        title="Participant Assessment Status"
        note="Per-child SANGIAN/VWM/DCCS/CD status - search, filter, and view the common-participant intersection"
      />
      <div className="table-card">
        <ParticipantAssessmentStatusPanel status={data} />
      </div>
    </section>
  );
}
