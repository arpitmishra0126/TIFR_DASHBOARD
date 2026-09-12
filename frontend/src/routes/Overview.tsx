import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getAssessmentToolStatus, getOverview } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import { percentOf } from "../components/charts/chartHelpers";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DonutChart from "../components/DonutChart";
import FullScreenLoader from "../components/FullScreenLoader";
import HorizontalBarChart from "../components/HorizontalBarChart";
import { IconChevron, IconClipboardCheck, IconMonitor, IconUserCheck, IconUsers } from "../components/icons";
import InstrumentCoverageCard from "../components/InstrumentCoverageCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import SnapshotMetricCard, { SnapshotCardShell } from "../components/SnapshotMetricCard";
import { useRefresh } from "../context/RefreshContext";
import type { AssessmentToolParticipantStatus, AssessmentToolStatusResponse, ConditionIndicator, OverviewResponse } from "../types/liveDashboard";
import { GROUPS } from "./AssessmentsHub";

// The 8 currently-mapped assessment instruments (excludes Registration/
// Baseline, which is already the "Registered" Snapshot KPI) - reuses the
// same instrument metadata (name/purpose/route/icon) as the Assessments hub
// so the two pages can never drift apart on what an instrument is called.
const OVERVIEW_INSTRUMENTS = GROUPS.flatMap((g) => g.available).filter((i) => i.key !== "registration");

interface SsrsRow {
  label: string;
  count: number;
  total: number;
  percent: number;
}

/** Single "SSRS" headline card holding the Parent/Child/Teacher breakdown
 * as compact label/value lines - deliberately one top-level card, not
 * three, per the 2026-09-08 Overview correction. Coverage-only (n/N/%),
 * no bars - the full SSRS item-level analysis stays on the
 * Neurodevelopment assessment page. */
function SsrsSummaryCard({ rows }: { rows: SsrsRow[] }) {
  return (
    <SnapshotCardShell label="SSRS" icon={IconUserCheck} tone="violet">
      <div className="snapshot-ssrs-list">
        {rows.map((row) => (
          <div className="snapshot-ssrs-row" key={row.label}>
            <span className="snapshot-ssrs-row-label">{row.label}</span>
            {row.count > 0 ? (
              <span className="snapshot-ssrs-row-value">
                {row.count}/{row.total} ({row.percent}%)
              </span>
            ) : (
              <span className="snapshot-ssrs-row-value snapshot-ssrs-row-muted">No data available</span>
            )}
          </div>
        ))}
      </div>
    </SnapshotCardShell>
  );
}

/** Highest-prevalence reported conditions/indicators, for a compact
 * Overview-level health signal - NOT the full item-level breakdown (that
 * stays exclusively on the Child Illness History assessment page). */
function topReportedItems(named: ConditionIndicator[], general: ConditionIndicator[], limit = 5): ConditionIndicator[] {
  return [...named, ...general]
    .filter((i) => i.yes_count > 0)
    .sort((a, b) => b.yes_count - a.yes_count || b.percent_yes - a.percent_yes)
    .slice(0, limit);
}

interface AtsColumn {
  key: string;
  label: string;
  tone: "blue" | "aqua" | "amber" | "violet";
  valueText: string;
  percentText: string;
}

/** Participant-level column - a child counts as Done only when every field
 * in that test's group is answered Done; denominator is always the total
 * registered participant count, never a sub-test or per-field valid_n
 * count. */
function atsParticipantColumn(label: string, tone: AtsColumn["tone"], status: AssessmentToolStatusResponse["sangian_participant"]): AtsColumn {
  return {
    key: label,
    label,
    tone,
    valueText: `${status.done_count}/${status.total}`,
    percentText: `${status.percent}%`,
  };
}

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
 * completion definition, no recalculation. */
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
        <span>Participant Assessment Status</span>
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

/** Compact "Assessment Tool Status" card - one participant-level Overall
 * figure (completed participants / total registered participants), then
 * SANGIAN/VWM/DCCS/CD as four equal, clearly SEPARATE columns (never
 * grouped), each also completed participants / total registered
 * participants - administration status only, not the assessments' own
 * outcome/performance data. */
function AssessmentToolStatusCard({ status }: { status: AssessmentToolStatusResponse }) {
  const overall = status.overall_participant;

  const columns: AtsColumn[] = [
    atsParticipantColumn("SANGIAN", "blue", status.sangian_participant),
    atsParticipantColumn("VWM", "aqua", status.vwm_participant),
    atsParticipantColumn("DCCS", "amber", status.dccs_participant),
    atsParticipantColumn("CD", "violet", status.cd_participant),
  ];

  return (
    <div className="ats-card">
      <div className="ats-overall">
        <span className="ats-overall-label">Overall Assessment Tool Status</span>
        <span className="ats-overall-value">
          {overall.done_count}/{overall.total}
          <span className="ats-overall-percent"> ({overall.percent}%)</span>
        </span>
      </div>
      <div className="ats-tests">
        {columns.map((col) => (
          <div className={`ats-test-col snapshot-tone-${col.tone}`} key={col.key}>
            <div className="ats-test-label">{col.label}</div>
            <div className="ats-test-value">{col.valueText}</div>
            <div className="ats-test-percent">{col.percentText}</div>
          </div>
        ))}
      </div>

      <ParticipantAssessmentStatusPanel status={status} />
    </div>
  );
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [assessmentToolStatus, setAssessmentToolStatus] = useState<AssessmentToolStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
    // Secondary section - a failure here must not block or break the rest
    // of the Overview page (Study Snapshot etc. are unaffected either way).
    getAssessmentToolStatus()
      .then(setAssessmentToolStatus)
      .catch(() => setAssessmentToolStatus(null));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview) return <FullScreenLoader message="Loading ICMR Neurodevelopment Study Dashboard..." />;

  const sesCoverage = overview.all_instrument_coverage.find((i) => i.key === "ses") ?? null;

  const partialCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "Partial");
  const noDataCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "No Data");
  const highCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "High");
  const totalDataPoints = overview.all_instrument_coverage.reduce((sum, i) => sum + i.completed_count, 0);

  const sexData = [
    { label: "Male", count: overview.sex_distribution.male },
    { label: "Female", count: overview.sex_distribution.female },
    { label: "Unknown", count: overview.sex_distribution.unknown },
  ].filter((d) => d.count > 0);

  const ageData = overview.age_distribution.map((b) => ({ label: b.label, count: b.count }));

  const udaiData = overview.udai_pareek_category_distribution.map((c) => ({
    label: c.code,
    count: c.count,
  }));

  const topHealthSignals = topReportedItems(overview.chh_named_conditions, overview.chh_general_flags, 1);

  const dseqAnswered = overview.dseq_screen_time_distribution.reduce((sum, c) => sum + c.count, 0);
  const dseqDominant = [...overview.dseq_screen_time_distribution].sort((a, b) => b.count - a.count)[0];

  return (
    <section className="overview-page">
      <PageHeader
        eyebrow="ICMR Neurodevelopment Study"
        title="Study Population & Assessment Dashboard"
        subtitle="Live snapshot of study registration and assessment progress."
      />

      <SectionHeader title="Study snapshot" note="Headline counts, each independently live-calculated from REDCap" />
      <div className="snapshot-strip">
        <SnapshotMetricCard
          label="Registered"
          value={overview.total_registered.toLocaleString()}
          support="Total study population"
          icon={IconUsers}
          tone="blue"
        />
        <SnapshotMetricCard
          label="SES Completed"
          value={(sesCoverage?.completed_count ?? 0).toLocaleString()}
          support={
            sesCoverage
              ? `${sesCoverage.completed_count}/${overview.total_registered} (${sesCoverage.percent_of_registered}%)`
              : "Data unavailable"
          }
          icon={IconClipboardCheck}
          tone="aqua"
        />
        <SnapshotMetricCard
          label="Assessment Tool Status"
          value={(assessmentToolStatus?.completion.completed ?? 0).toLocaleString()}
          support={
            assessmentToolStatus
              ? `${assessmentToolStatus.completion.completed}/${assessmentToolStatus.completion.total_registered} (${assessmentToolStatus.completion.percent}%)`
              : "Data unavailable"
          }
          icon={IconMonitor}
          tone="amber"
        />
        <SsrsSummaryCard
          rows={[
            { label: "Parent", count: overview.ssrs_parent_count, total: overview.total_registered, percent: overview.ssrs_parent_percent },
            { label: "Child", count: overview.ssrs_child_count, total: overview.total_registered, percent: overview.ssrs_child_percent },
            { label: "Teacher", count: overview.ssrs_teacher_count, total: overview.total_registered, percent: overview.ssrs_teacher_percent },
          ]}
        />
      </div>

      {assessmentToolStatus && (
        <>
          <SectionHeader title="Assessment Tool Status" note="Administration status only - not outcome data" />
          <AssessmentToolStatusCard status={assessmentToolStatus} />
        </>
      )}

      <SectionHeader title="Study profile" note="Who is registered in the study" />
      <div className="chart-grid two-col">
        <ChartCard title="Sex Distribution" subtitle="Registered children, by sex">
          <DonutChart data={sexData} height={190} centerValue={overview.total_registered} centerLabel="Registered" />
        </ChartCard>
        <ChartCard title="Age Distribution" subtitle="Registered children, by study age group">
          <CategoryBarChart data={ageData} mode="sequential" height={190} />
        </ChartCard>
      </div>
      <ChartCard title="SES Category (Udai Pareek)" subtitle="Registered children with an SES score">
        <HorizontalBarChart data={udaiData} mode="sequential" />
      </ChartCard>

      <SectionHeader
        title="Assessment coverage"
        note="Each of the 8 currently-mapped study instruments, independently calculated - tap a card for its full analysis"
      />
      <div className="instrument-grid">
        {OVERVIEW_INSTRUMENTS.map((instrument) => (
          <InstrumentCoverageCard key={instrument.key} instrument={instrument} overview={overview} />
        ))}
      </div>

      <SectionHeader title="Current data signals" note="What we're seeing - one high-level indicator per instrument; full item-level analysis lives on each assessment page" />
      <div className="chart-grid two-col">
        <ChartCard
          title="Most commonly reported condition or indicator"
          subtitle={`Child Illness History · ${overview.chh_completion.completed}/${overview.chh_completion.total_registered} completed (${overview.chh_completion.percent}%)`}
        >
          {topHealthSignals.length === 0 ? (
            <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
              No conditions or indicators have been reported "Yes" yet among completed records.
            </p>
          ) : (
            <div className="response-list">
              {topHealthSignals.map((item) => (
                <div className="response-item" key={item.label}>
                  <div className="response-item-header">
                    <span className="response-item-label">{item.label}</span>
                    <span className="response-item-value">
                      {item.yes_count} ({item.percent_yes}%)
                    </span>
                  </div>
                  <ProportionBar value={item.yes_count} total={item.valid_n} color="var(--series-1)" />
                </div>
              ))}
            </div>
          )}
          <Link to="/health-screening" className="chart-card-link">
            View full Child Illness History analysis →
          </Link>
        </ChartCard>

        <ChartCard
          title="Dominant total daily screen time"
          subtitle={`DSEQ · ${overview.dseq_completion.completed}/${overview.dseq_completion.total_registered} completed (${overview.dseq_completion.percent}%)`}
        >
          {dseqAnswered === 0 || !dseqDominant ? (
            <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
              No DSEQ Q10 responses have been recorded yet.
            </p>
          ) : (
            <div className="response-item">
              <div className="response-item-header">
                <span className="response-item-label">Most reported: {dseqDominant.code}</span>
                <span className="response-item-value">
                  {dseqDominant.count} / {dseqAnswered} ({percentOf(dseqDominant.count, dseqAnswered)}%)
                </span>
              </div>
              <ProportionBar value={dseqDominant.count} total={dseqAnswered} color="var(--series-1)" />
            </div>
          )}
          <Link to="/screen-time" className="chart-card-link">
            View full Screen Time (DSEQ) analysis →
          </Link>
        </ChartCard>
      </div>

      <ChartCard title="Data Collection & Quality Status" subtitle="Where collection currently stands, and where it is lagging">
        <div className="status-stat-grid">
          <div className="status-stat">
            <div className="status-stat-value">{totalDataPoints.toLocaleString()}</div>
            <div className="status-stat-label">Instrument completions collected (across all 9 instruments)</div>
          </div>
          <div className="status-stat">
            <div className="status-stat-value">
              {highCoverage.length} / {overview.all_instrument_coverage.length}
            </div>
            <div className="status-stat-label">Instruments at High coverage (≥50% of registered)</div>
          </div>
          <div className="status-stat">
            <div className="status-stat-value">
              {partialCoverage.length + noDataCoverage.length} / {overview.all_instrument_coverage.length}
            </div>
            <div className="status-stat-label">Instruments needing attention (Partial or No Data)</div>
          </div>
        </div>

        {(partialCoverage.length > 0 || noDataCoverage.length > 0) && (
          <div className="status-flag-list">
            {partialCoverage.length > 0 && (
              <p className="status-flag-row">
                <span className="status-flag-tag status-flag-tag-warning">Partial coverage</span>
                {partialCoverage.map((i) => i.label).join(", ")}
              </p>
            )}
            {noDataCoverage.length > 0 && (
              <p className="status-flag-row">
                <span className="status-flag-tag status-flag-tag-neutral">No completed assessments yet</span>
                {noDataCoverage.map((i) => i.label).join(", ")}
              </p>
            )}
          </div>
        )}
      </ChartCard>
    </section>
  );
}
