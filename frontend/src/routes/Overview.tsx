import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAssessmentToolStatus, getHealthScreening, getOverview, getRegistry, getScreenTime } from "../api/dashboard";
import { percentOf } from "../components/charts/chartHelpers";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import {
  IconBrain,
  IconCalendar,
  IconChart,
  IconClipboardCheck,
  IconGraduationCap,
  IconHeart,
  IconMonitor,
  IconUsers,
} from "../components/icons";
import { useRefresh } from "../context/RefreshContext";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import type {
  AssessmentToolStatusResponse,
  HealthScreeningResponse,
  OverviewResponse,
  RegistryChild,
  ScreenTimeResponse,
} from "../types/liveDashboard";
import { INSTRUMENT_COLUMNS } from "./Registry";

/** Dashboard rebuilt as a central STUDY INFORMATION HUB (2026-09-28) -
 * a quick, one-screen overview of the whole study flow and an entry point
 * into deeper module pages, not a second analytics page. The previous
 * version's large detailed Assessment Progress table, full 3-column Study
 * Profile breakdown, 8-row Assessment Coverage list, right-hand detail
 * panel, and Quick Actions list were all removed from this page per
 * explicit instruction - none of the underlying data/calculations were
 * deleted, they were either condensed into a one-line summary here (Study
 * Snapshot) or relocated to their proper dedicated page (the participant-
 * level Assessment Tool Status table now lives on `/assessment-tool-
 * status`; the Excel/CSV exports already lived on `/registry`
 * independently, so nothing was lost by removing the duplicate Quick
 * Actions buttons here).
 *
 * Every figure on this page is read from the existing `/dashboard/overview`,
 * `/dashboard/assessment-tool-status`, `/dashboard/screen-time`, and
 * `/dashboard/health` responses - no new backend endpoint, field, or
 * calculation was added; the last two were already-existing endpoints,
 * simply not previously fetched by this page. */

type Tone = "blue" | "teal" | "violet" | "amber" | "cyan" | "pink";

function MonitorBar({ percent, tone = "blue" }: { percent: number; tone?: Tone }) {
  return (
    <div className={`monitor-bar monitor-bar-tone-${tone}`}>
      <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

/** "Study Progress" pipeline - a proper document-flow layout (2026-09-28,
 * third pass): Registration (standalone anchor) -> a dedicated static
 * connector -> a clearly bordered "Core Data Collection" section (its own
 * heading + a CSS Grid of the 8 parallel module cards, no sequential order
 * implied among them) -> another dedicated static connector -> Assessment
 * Tools (standalone anchor). Nothing is absolutely positioned across the
 * whole component, so a connector can never overlap a card - every
 * connector is a normal flex child occupying its own row. Every count/
 * percent is a direct read of `overview.all_instrument_coverage` /
 * `assessmentToolStatus.overall_participant` - no new calculation. The
 * only animated element is the pair of short horizontal rule segments in
 * the Core Data Collection heading (a scrolling dashed highlight, CSS
 * only) - both dedicated vertical connectors stay static, since a vertical
 * connector must never receive the horizontal scrolling treatment. */
interface PipelineNodeData {
  key: string;
  label: string;
  count: number;
  total: number;
  tone: Tone;
  linkTo?: string;
  /** SSRS-only (2026-09-28 senior requirement): Parent/Child/Teacher shown
   * as one consolidated module rather than three separate cards. When
   * present, the card renders these lines instead of a single count/total
   * line - each still denominated by the same `total` (222, the overall
   * study cohort) as the rest of the Study Progress visualization. */
  breakdown?: { label: string; count: number }[];
}

function PipelineNode({ node }: { node: PipelineNodeData }) {
  const hasBreakdown = !!node.breakdown && node.breakdown.length > 0;
  const percent = percentOf(node.count, node.total);
  const complete = !hasBreakdown && percent >= 100;
  const className = `pipeline-node monitor-tone-${node.tone}${complete ? " pipeline-node-complete" : ""}${
    node.linkTo ? " pipeline-node-clickable" : ""
  }`;
  const content = (
    <>
      <span className="pipeline-node-label">{node.label}</span>
      {hasBreakdown ? (
        <span className="pipeline-node-breakdown">
          {node.breakdown!.map((item) => {
            const itemPercent = percentOf(item.count, node.total);
            return (
              <span key={item.label} className="pipeline-node-breakdown-item">
                <span className="pipeline-node-breakdown-text">
                  {item.label} {item.count}/{node.total} <span className="pipeline-node-percent">({itemPercent}%)</span>
                </span>
                <MonitorBar percent={itemPercent} tone={node.tone} />
              </span>
            );
          })}
        </span>
      ) : (
        <>
          <span className="pipeline-node-value">
            {node.count}/{node.total} <span className="pipeline-node-percent">({percent}%)</span>
          </span>
          <MonitorBar percent={percent} tone={node.tone} />
        </>
      )}
    </>
  );
  return node.linkTo ? (
    <Link to={node.linkTo} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function PipelineConnector() {
  return (
    <div className="pipeline-connector" aria-hidden="true">
      <span className="pipeline-connector-line" />
      <span className="pipeline-connector-arrow" />
    </div>
  );
}

function StudyProgressPipeline({
  registration,
  coreModules,
  assessmentTools,
}: {
  registration: PipelineNodeData;
  coreModules: PipelineNodeData[];
  assessmentTools: PipelineNodeData | null;
}) {
  return (
    <div className="pipeline">
      <div className="pipeline-anchor">
        <PipelineNode node={registration} />
      </div>

      <PipelineConnector />

      <div className="pipeline-core-section">
        <div className="pipeline-core-heading">
          <span className="pipeline-core-heading-line" />
          <span className="pipeline-core-heading-label">Core Data Collection</span>
          <span className="pipeline-core-heading-line" />
        </div>
        <div className="pipeline-core-grid">
          {coreModules.map((node) => (
            <PipelineNode key={node.key} node={node} />
          ))}
        </div>
      </div>

      {assessmentTools && (
        <>
          <PipelineConnector />
          <div className="pipeline-anchor">
            <PipelineNode node={assessmentTools} />
          </div>
        </>
      )}
    </div>
  );
}

/** Key Study Module / infographic indicator row (2026-09-28 infographic
 * redesign) - a label/value line with an optional thin progress bar
 * visualising that same already-displayed number (never a second, invented
 * metric), and an optional `breakdown` for a single named indicator that
 * is itself made of two real sub-figures (e.g. "Chronic / neurological" -
 * two existing composite indicators shown as two small bars under one
 * label, instead of concatenated into one line of text). */
function ModuleIndicator({
  label,
  value,
  percent,
  tone = "blue",
  breakdown,
}: {
  label: string;
  value?: string;
  percent?: number;
  tone?: Tone;
  breakdown?: { label: string; value: string; percent: number; tone?: Tone }[];
}) {
  return (
    <div className="module-indicator">
      <div className="module-indicator-row">
        <span className="module-indicator-label">{label}</span>
        {value !== undefined && <span className="module-indicator-value">{value}</span>}
      </div>
      {percent !== undefined && <MonitorBar percent={percent} tone={tone} />}
      {breakdown && (
        <div className="module-indicator-breakdown">
          {breakdown.map((item) => (
            <div key={item.label} className="module-indicator-breakdown-item">
              <div className="module-indicator-row module-indicator-row-sub">
                <span className="module-indicator-sublabel">{item.label}</span>
                <span className="module-indicator-subvalue">{item.value}</span>
              </div>
              <MonitorBar percent={item.percent} tone={item.tone ?? tone} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A small two-value horizontal comparison (e.g. School-day vs Weekend
 * screen time) - each bar's length is scaled against the larger of the two
 * `magnitude` values, so the pair is a genuine visual comparison, not two
 * independent 0-100% bars. Used only where the underlying values are a
 * real, already-displayed pair of numbers - never invented. */
function DualMetricBars({ tone, items }: { tone: Tone; items: { label: string; value: string; magnitude: number }[] }) {
  const max = Math.max(...items.map((item) => item.magnitude), 1);
  return (
    <div className="dual-metric-bars">
      {items.map((item) => (
        <div key={item.label} className="dual-metric-item">
          <div className="module-indicator-row">
            <span className="module-indicator-label">{item.label}</span>
            <span className="module-indicator-value">{item.value}</span>
          </div>
          <MonitorBar percent={(item.magnitude / max) * 100} tone={tone} />
        </div>
      ))}
    </div>
  );
}

/** Fixed colour mapping for the Study Snapshot Sex Distribution split bar -
 * a presentation choice only, not a new data field. */
function sexTone(label: string): Tone {
  if (label === "Male") return "blue";
  if (label === "Female") return "pink";
  return "amber";
}

/** A thin, square-ended horizontal split bar (e.g. Male/Female proportion)
 * - segments sized directly by their own real percent share, never a
 * rounded/pill shape. */
function SplitBar({ segments }: { segments: { tone: Tone; percent: number }[] }) {
  return (
    <div className="split-bar">
      {segments.map((segment, index) => (
        <div key={index} className={`split-bar-segment monitor-tone-${segment.tone}`} style={{ width: `${segment.percent}%` }} />
      ))}
    </div>
  );
}

function remainingCoreLabels(child: RegistryChild, coreBatteryColumns: { key: string; label: string }[]): string[] {
  return coreBatteryColumns.filter((col) => !child.instrument_status[col.key]).map((col) => col.label);
}

const CORE_BATTERY_KEYS = ["ses", "dseq", "child_illness_history", "paq_a", "dietary_intake", "ssrs_parent"];
const CORE_BATTERY_COLUMNS = INSTRUMENT_COLUMNS.filter((col) => CORE_BATTERY_KEYS.includes(col.key));

/** "Remaining Core Assessments" drawer - opened from the Core Assessment
 * Completion strip figure. Unchanged from the prior version: fetches the
 * same Registry data the Participants page already uses
 * (`core_battery_complete=false`), then reads each child's own
 * `instrument_status` for the 6 core instruments - no new backend
 * endpoint, no new completion definition. */
function CoreRemainingDrawer({
  isOpen,
  onClose,
  totalRegistered,
  coreCompleteCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  totalRegistered: number;
  coreCompleteCount: number;
}) {
  const [children, setChildren] = useState<RegistryChild[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState("all");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setLoadError(null);
    getRegistry({ coreBatteryComplete: false, limit: 500 })
      .then((res) => setChildren(res.children))
      .catch((err: Error) => setLoadError(err.message));
  }, [isOpen, retryToken]);

  const rows = (children ?? [])
    .map((child) => ({ child, remaining: remainingCoreLabels(child, CORE_BATTERY_COLUMNS) }))
    .filter((row) => row.remaining.length > 0);

  const filteredRows = rows.filter(({ child, remaining }) => {
    const q = query.trim().toLowerCase();
    if (q && !child.redcap_child_id.toLowerCase().includes(q)) return false;
    if (instrumentFilter !== "all") {
      const col = CORE_BATTERY_COLUMNS.find((c) => c.key === instrumentFilter);
      if (!col || !remaining.includes(col.label)) return false;
    }
    return true;
  });

  if (!isOpen) return null;

  const remainingCount = totalRegistered - coreCompleteCount;

  return (
    <div className="core-remaining-overlay" onClick={onClose}>
      <div className="core-remaining-panel" onClick={(e) => e.stopPropagation()}>
        <div className="core-remaining-header">
          <div>
            <div className="core-remaining-title">Remaining Core Assessments</div>
            <div className="core-remaining-summary">
              {remainingCount} / {totalRegistered} participants remaining
            </div>
          </div>
          <button type="button" className="registry-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

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
            value={instrumentFilter}
            onChange={(e) => setInstrumentFilter(e.target.value)}
            aria-label="Filter by remaining instrument"
          >
            <option value="all">Any remaining instrument</option>
            {CORE_BATTERY_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
        </div>

        {loadError && <DataLoadError message={loadError} onRetry={() => setRetryToken((t) => t + 1)} />}
        {!loadError && !children && <p className="ats-pstatus-empty">Loading participant status...</p>}
        {!loadError && children && (
          <div className="ats-pstatus-table-wrap">
            <table className="ats-pstatus-table core-remaining-table">
              <thead>
                <tr>
                  <th className="ats-pstatus-id-col">Participant ID</th>
                  <th>Remaining Forms / Assessments</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ child, remaining }) => (
                  <tr key={child.redcap_child_id}>
                    <td className="ats-pstatus-id-cell">{child.redcap_child_id}</td>
                    <td className="core-remaining-forms-cell">{remaining.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && <p className="ats-pstatus-empty">No participants match this search/filter.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [assessmentToolStatus, setAssessmentToolStatus] = useState<AssessmentToolStatusResponse | null>(null);
  const [screenTime, setScreenTime] = useState<ScreenTimeResponse | null>(null);
  const [health, setHealth] = useState<HealthScreeningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
    // Secondary sections - a failure on any of these must not block or
    // break the rest of the hub page, so each is fetched/caught
    // independently and simply doesn't render its card if unavailable.
    getAssessmentToolStatus()
      .then(setAssessmentToolStatus)
      .catch(() => setAssessmentToolStatus(null));
    getScreenTime()
      .then(setScreenTime)
      .catch(() => setScreenTime(null));
    getHealthScreening()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview) return <FullScreenLoader message="Loading ICMR Neurodevelopment Study Dashboard..." />;

  const findCoverage = (key: string) => overview.all_instrument_coverage.find((c) => c.key === key);

  /* 2026-09-28 senior requirement, corrected same day: every number/percent
   * displayed anywhere on this Dashboard now uses the overall study cohort
   * (222, `STUDY_ORIGINAL_ENROLLMENT`) as its denominator - not
   * `overview.total_registered` (212, the current live-REDCap registered/
   * active population), which is intentionally never read or shown on
   * this page anymore. This is a display-only change: every numerator
   * (completed_count, done_count, etc.) is still the real, live REDCap
   * value; only which number it's divided/shown against changed. Other
   * pages (Registry, Data Quality, the dedicated Assessment Tool Status
   * page, Demographics, etc.) are untouched and still correctly show the
   * real 212 registered/active population where that is the relevant
   * figure for their own purpose. */
  const studyDenominator = STUDY_ORIGINAL_ENROLLMENT;

  const simpleCoreModuleDefs: { key: string; label: string; tone: Tone; linkTo?: string }[] = [
    { key: "ses", label: "SES", tone: "teal" },
    { key: "child_illness_history", label: "Child Health History", tone: "blue", linkTo: "/health-screening" },
    { key: "dseq", label: "DSEQ / Screen Time", tone: "violet", linkTo: "/screen-time" },
    { key: "paq_a", label: "PAQ / Physical Activity", tone: "cyan" },
    { key: "dietary_intake", label: "Dietary Intake", tone: "amber" },
  ];
  const simpleCoreModules: PipelineNodeData[] = simpleCoreModuleDefs.map((def) => {
    const coverage = findCoverage(def.key);
    return { key: def.key, label: def.label, count: coverage?.completed_count ?? 0, total: studyDenominator, tone: def.tone, linkTo: def.linkTo };
  });

  /* SSRS consolidated into one module (2026-09-28) - Parent/Child/Teacher
   * are shown as a breakdown inside a single card, never as three separate
   * grid cells, per explicit instruction. */
  const ssrsModule: PipelineNodeData = {
    key: "ssrs",
    label: "SSRS",
    count: findCoverage("ssrs_parent")?.completed_count ?? 0,
    total: studyDenominator,
    tone: "pink",
    breakdown: [
      { label: "Parent", count: findCoverage("ssrs_parent")?.completed_count ?? 0 },
      { label: "Child", count: findCoverage("ssrs_child")?.completed_count ?? 0 },
      { label: "Teacher", count: findCoverage("ssrs_teacher")?.completed_count ?? 0 },
    ],
  };

  const coreModules: PipelineNodeData[] = [...simpleCoreModules, ssrsModule];

  const sexData = [
    { label: "Male", count: overview.sex_distribution.male },
    { label: "Female", count: overview.sex_distribution.female },
    { label: "Unknown", count: overview.sex_distribution.unknown },
  ].filter((d) => d.count > 0);
  const sexTotal = sexData.reduce((s, d) => s + d.count, 0);

  const ageData = overview.age_distribution.filter((b) => b.count > 0);
  const dominantAge = [...ageData].sort((a, b) => b.count - a.count)[0];
  const ageTotal = ageData.reduce((s, d) => s + d.count, 0);

  const sesCoverage = findCoverage("ses");

  return (
    <section className="overview-page">
      {/* --- 1. Top KPI strip (2026-09-28: "Original Cohort" card removed;
          2026-09-28 correction (same day): every displayed number/percent
          on this Dashboard now uses the overall study cohort (222,
          `studyDenominator`) as its denominator - `overview.total_
          registered` (212) is intentionally never read on this page
          anymore. Percentages that the API computed against 212
          (`assessmentToolStatus.overall_participant.percent`, `overview
          .core_assessment_percent`) are recomputed here with
          `percentOf(count, studyDenominator)` rather than used as-is, so
          no 212-denominated percent survives either. --- */}
      <div className="stat-strip">
        <div className="stat-block">
          <span className="stat-block-label">Current Active Cases</span>
          <span className="stat-block-value">{studyDenominator.toLocaleString()}</span>
          <span className="stat-block-footnote">Overall study cohort</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Assessment Progress</span>
          <span className="stat-block-value">
            {assessmentToolStatus ? `${assessmentToolStatus.overall_participant.done_count} / ${studyDenominator}` : "—"}
          </span>
          {assessmentToolStatus && (
            <MonitorBar percent={percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)} tone="violet" />
          )}
          {assessmentToolStatus && (
            <span className="stat-block-footnote">{percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)}%</span>
          )}
        </div>
        <button type="button" className="stat-block stat-block-clickable" onClick={() => setRemainingOpen(true)}>
          <span className="stat-block-label">Core Assessment Completion</span>
          <span className="stat-block-value">
            {overview.core_assessment_count} / {studyDenominator}
          </span>
          <MonitorBar percent={percentOf(overview.core_assessment_count, studyDenominator)} tone="amber" />
          <span className="stat-block-footnote">{percentOf(overview.core_assessment_count, studyDenominator)}% · View remaining →</span>
        </button>
      </div>

      <CoreRemainingDrawer
        isOpen={remainingOpen}
        onClose={() => setRemainingOpen(false)}
        totalRegistered={studyDenominator}
        coreCompleteCount={overview.core_assessment_count}
      />

      {/* --- 2. Study Progress - animated connected pipeline --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Study Progress</span>
          <span className="monitor-section-note">Registration → parallel core modules → assessment tools</span>
        </div>
        <StudyProgressPipeline
          registration={{
            key: "registration",
            label: "Registration / Cohort",
            /* Per the explicit senior example ("Registration / Cohort →
             * 222/222"), this node represents whole-cohort enrollment
             * itself, so its count is the same overall-cohort figure as
             * its denominator - not the live registration-form completion
             * count (212), which would otherwise reintroduce a visible
             * "212" here. */
            count: studyDenominator,
            total: studyDenominator,
            tone: "blue",
          }}
          coreModules={coreModules}
          assessmentTools={
            assessmentToolStatus
              ? {
                  key: "assessment_tools",
                  label: "Assessment Tools",
                  count: assessmentToolStatus.overall_participant.done_count,
                  total: studyDenominator,
                  tone: "cyan",
                }
              : null
          }
        />
      </div>

      {/* --- 3. Key Study Modules - two featured infographic cards, DSEQ and
          Child Health History (2026-09-28 infographic redesign - a
          balanced 2-column layout, each card led by a large dominant
          completion figure and a small real-data visual comparison, not a
          plain full-width text row). --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Key Study Modules</span>
          <span className="monitor-section-note">Featured modules - full analysis on their own page</span>
        </div>
        <div className="key-module-grid">
          <Link to="/screen-time" className="key-module-card featured-module-card monitor-tone-violet">
            <div className="featured-module-head">
              <span className="featured-module-icon">
                <IconMonitor width={15} height={15} />
              </span>
              <span className="key-module-name">DSEQ / Screen Time</span>
            </div>
            {screenTime ? (
              <>
                <div className="featured-module-headline">
                  <span className="featured-module-headline-value">
                    {screenTime.completion.completed} / {studyDenominator}
                  </span>
                  <span className="featured-module-headline-percent">
                    {percentOf(screenTime.completion.completed, studyDenominator)}% instrument completion
                  </span>
                </div>
                <MonitorBar percent={percentOf(screenTime.completion.completed, studyDenominator)} tone="violet" />
                <p className="key-module-description">Digital Screen Exposure Questionnaire - screen time, physical activity, media behaviour.</p>
                <ModuleIndicator
                  label="Avg daily screen time"
                  value={screenTime.average_daily_summary.mean !== null ? `${Math.round(screenTime.average_daily_summary.mean)} min (est.)` : "No data"}
                />
                {screenTime.school_day_summary.mean !== null && screenTime.weekend_summary.mean !== null && (
                  <DualMetricBars
                    tone="violet"
                    items={[
                      { label: "School-day", value: `${Math.round(screenTime.school_day_summary.mean)} min`, magnitude: screenTime.school_day_summary.mean },
                      { label: "Weekend", value: `${Math.round(screenTime.weekend_summary.mean)} min`, magnitude: screenTime.weekend_summary.mean },
                    ]}
                  />
                )}
              </>
            ) : (
              <p className="module-indicator">Data unavailable</p>
            )}
            <span className="monitor-detail-link">View DSEQ →</span>
          </Link>

          <Link to="/health-screening" className="key-module-card featured-module-card monitor-tone-blue">
            <div className="featured-module-head">
              <span className="featured-module-icon">
                <IconHeart width={15} height={15} />
              </span>
              <span className="key-module-name">Child Health History</span>
            </div>
            {health ? (
              <>
                <div className="featured-module-headline">
                  <span className="featured-module-headline-value">
                    {health.completion.completed} / {studyDenominator}
                  </span>
                  <span className="featured-module-headline-percent">{percentOf(health.completion.completed, studyDenominator)}% instrument completion</span>
                </div>
                <MonitorBar percent={percentOf(health.completion.completed, studyDenominator)} tone="blue" />
                <p className="key-module-description">Baseline health and illness history - current health, chronic/neurological history, assessment readiness.</p>
                <ModuleIndicator
                  label="Current illness"
                  value={`${health.chh.current_health.currently_ill.yes_count}/${health.chh.current_health.currently_ill.valid_n}`}
                  percent={health.chh.current_health.currently_ill.percent_yes}
                  tone="blue"
                />
                <ModuleIndicator
                  label="Chronic / neurological"
                  tone="pink"
                  breakdown={[
                    {
                      label: "Chronic condition",
                      value: `${health.chh.chronic_illness.any_listed_condition.yes_count}/${health.chh.chronic_illness.any_listed_condition.valid_n}`,
                      percent: health.chh.chronic_illness.any_listed_condition.percent_yes,
                      tone: "amber",
                    },
                    {
                      label: "Neurological history",
                      value: `${health.chh.neurological.any_neurological_history.yes_count}/${health.chh.neurological.any_neurological_history.valid_n}`,
                      percent: health.chh.neurological.any_neurological_history.percent_yes,
                      tone: "pink",
                    },
                  ]}
                />
                <ModuleIndicator
                  label="Assessment readiness concern"
                  value={`${health.chh.assessment_day.any_assessment_day_concern_count}/${health.chh.assessment_day.any_assessment_day_concern_total}`}
                  percent={percentOf(health.chh.assessment_day.any_assessment_day_concern_count, health.chh.assessment_day.any_assessment_day_concern_total)}
                  tone="cyan"
                />
              </>
            ) : (
              <p className="module-indicator">Data unavailable</p>
            )}
            <span className="monitor-detail-link">View Child Health →</span>
          </Link>
        </div>
      </div>

      {/* --- 4. Assessment Progress - compact infographic (2026-09-28
          redesign): one visually dominant "Overall Assessment" block, then
          the four tools as a compact comparative grid underneath, not a
          stack of full-width table-like rows. --- */}
      {assessmentToolStatus && (
        <div className="monitor-section">
          <div className="monitor-section-head">
            <span className="monitor-section-title">Assessment Progress</span>
            <span className="monitor-section-note">Administration status only - not outcome data</span>
          </div>
          <div className="assessment-infographic">
            <div className="assessment-overall-block monitor-tone-blue">
              <span className="assessment-overall-label">Overall Assessment</span>
              <span className="assessment-overall-value">
                {assessmentToolStatus.overall_participant.done_count} / {studyDenominator}
              </span>
              <MonitorBar percent={percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)} tone="blue" />
              <span className="assessment-overall-percent">
                {percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)}%
              </span>
            </div>
            <div className="assessment-tool-grid">
              {(
                [
                  { key: "sangian", label: "SANGIAN", icon: IconGraduationCap, tone: "teal", count: assessmentToolStatus.sangian_participant.done_count },
                  { key: "vwm", label: "VWM", icon: IconBrain, tone: "violet", count: assessmentToolStatus.vwm_participant.done_count },
                  { key: "dccs", label: "DCCS", icon: IconClipboardCheck, tone: "cyan", count: assessmentToolStatus.dccs_participant.done_count },
                  { key: "cd", label: "CD", icon: IconMonitor, tone: "amber", count: assessmentToolStatus.cd_participant.done_count },
                ] as { key: string; label: string; icon: typeof IconBrain; tone: Tone; count: number }[]
              ).map((tool) => {
                const percent = percentOf(tool.count, studyDenominator);
                const Icon = tool.icon;
                return (
                  <div key={tool.key} className={`assessment-tool-block monitor-tone-${tool.tone}`}>
                    <span className="assessment-tool-icon">
                      <Icon width={13} height={13} />
                    </span>
                    <span className="assessment-tool-label">{tool.label}</span>
                    <span className="assessment-tool-value">
                      {tool.count} / {studyDenominator}
                    </span>
                    <MonitorBar percent={percent} tone={tool.tone} />
                    <span className="assessment-tool-percent">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Link to="/assessment-tool-status" className="monitor-detail-link">
            View Assessment Details →
          </Link>
        </div>
      )}

      {/* --- 5. Study Snapshot - three compact infographic blocks
          (2026-09-28 redesign): Sex Distribution (split bar), Age Profile
          (per-bucket mini bars), SES Coverage (dominant figure + bar) - a
          3-column layout instead of a stacked full-width text list. --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Study Snapshot</span>
          <span className="monitor-section-note">Who is registered in the study</span>
        </div>
        <div className="snapshot-infographic-grid">
          <div className="snapshot-block monitor-tone-blue">
            <div className="snapshot-block-head">
              <IconUsers width={14} height={14} />
              <span className="snapshot-block-title">Sex Distribution</span>
            </div>
            <SplitBar segments={sexData.map((d) => ({ tone: sexTone(d.label), percent: percentOf(d.count, sexTotal) }))} />
            <div className="split-bar-legend">
              {sexData.map((d) => (
                <span key={d.label} className="split-bar-legend-item">
                  <span className={`split-bar-legend-dot monitor-tone-${sexTone(d.label)}`} />
                  {d.label} {percentOf(d.count, sexTotal)}%
                </span>
              ))}
            </div>
          </div>

          <div className="snapshot-block monitor-tone-violet">
            <div className="snapshot-block-head">
              <IconCalendar width={14} height={14} />
              <span className="snapshot-block-title">Age Profile</span>
            </div>
            <div className="snapshot-age-list">
              {ageData.map((bucket) => {
                const percent = percentOf(bucket.count, ageTotal);
                const isDominant = dominantAge?.label === bucket.label;
                return (
                  <div key={bucket.label} className="snapshot-age-row">
                    <div className="module-indicator-row">
                      <span className={`module-indicator-label${isDominant ? " snapshot-age-label-dominant" : ""}`}>{bucket.label}</span>
                      <span className="module-indicator-value">{percent}%</span>
                    </div>
                    <MonitorBar percent={percent} tone={isDominant ? "violet" : "blue"} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="snapshot-block monitor-tone-teal">
            <div className="snapshot-block-head">
              <IconChart width={14} height={14} />
              <span className="snapshot-block-title">SES Coverage</span>
            </div>
            {sesCoverage ? (
              <>
                <span className="snapshot-ses-value">
                  {sesCoverage.completed_count} / {studyDenominator}
                </span>
                <MonitorBar percent={percentOf(sesCoverage.completed_count, studyDenominator)} tone="teal" />
                <span className="snapshot-ses-percent">{percentOf(sesCoverage.completed_count, studyDenominator)}% instrument completion</span>
              </>
            ) : (
              <p className="module-indicator">No data</p>
            )}
          </div>
        </div>
        <Link to="/demographics" className="monitor-detail-link">
          View Demographics →
        </Link>
      </div>
    </section>
  );
}
