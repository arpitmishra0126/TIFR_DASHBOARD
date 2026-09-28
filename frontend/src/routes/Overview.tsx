import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { exportActiveCases, exportActiveCasesCsv, getAssessmentToolStatus, getOverview, getRegistry } from "../api/dashboard";
import { percentOf } from "../components/charts/chartHelpers";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import { IconChevron } from "../components/icons";
import { useRefresh } from "../context/RefreshContext";
import type {
  AssessmentToolParticipantStatus,
  AssessmentToolStatusResponse,
  OverviewResponse,
  RegistryChild,
} from "../types/liveDashboard";
import { STUDY_DECEASED_COUNT, STUDY_MIGRATED_COUNT, STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import { GROUPS } from "./AssessmentsHub";
import { INSTRUMENT_COLUMNS } from "./Registry";

// The 8 currently-mapped assessment instruments (excludes Registration/
// Baseline, which is already its own strip figure) - reuses the same
// instrument metadata (name/purpose/route) as the Assessments hub so the
// two pages can never drift apart on what an instrument is called.
const OVERVIEW_INSTRUMENTS = GROUPS.flatMap((g) => g.available).filter((i) => i.key !== "registration");

/** The six Core Assessment Battery instruments, in the same order/labels as
 * backend `CORE_BATTERY_INSTRUMENTS` (backend/app/ingestion/live_field_map.py)
 * and Registry's own `INSTRUMENT_COLUMNS` (frontend/src/routes/Registry.tsx)
 * - filtered from that single shared label source rather than a second
 * hardcoded key/label map, so the two can never drift apart. Used only to
 * read each child's own `instrument_status` booleans for these six keys -
 * the "core battery complete" definition itself is still computed
 * exclusively by the backend, never recomputed here. */
const CORE_BATTERY_KEYS = ["ses", "dseq", "child_illness_history", "paq_a", "dietary_intake", "ssrs_parent"];
const CORE_BATTERY_COLUMNS = INSTRUMENT_COLUMNS.filter((col) => CORE_BATTERY_KEYS.includes(col.key));

type Tone = "blue" | "teal" | "violet" | "amber";

/** One row of the right-hand detail panel - a plain label/value pair,
 * optionally with its own percent (renders a thin bar) or a tone accent. */
interface DetailRow {
  label: string;
  value: string;
  percent?: number;
  tone?: Tone;
}

interface DetailContent {
  title: string;
  subtitle?: string;
  rows: DetailRow[];
  linkTo?: string;
  linkLabel?: string;
}

/** Thin, sharp-cornered progress line - the compact-row equivalent used
 * throughout this redesigned page instead of a donut/large chart. */
function MonitorBar({ percent, tone = "blue" }: { percent: number; tone?: Tone }) {
  return (
    <div className={`monitor-bar monitor-bar-tone-${tone}`}>
      <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

/** One clickable metric row: label, thin bar, count/percent - the base unit
 * of every compact section on this page. Selecting a row updates the
 * right-hand detail panel via `onSelect`. */
function MetricRow({
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
  tone?: Tone;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={`monitor-row monitor-tone-${tone}${selected ? " monitor-row-selected" : ""}`}
      onClick={onSelect}
      disabled={!onSelect}
    >
      <span className="monitor-row-label">
        <span className="monitor-row-dot" />
        {label}
      </span>
      <span className="monitor-row-value">{valueText}</span>
      {percent !== undefined && <MonitorBar percent={percent} tone={tone} />}
    </button>
  );
}

function DetailPanel({ content }: { content: DetailContent | null }) {
  if (!content) {
    return (
      <div className="monitor-detail-panel">
        <p className="monitor-detail-empty">Select a metric row for its breakdown.</p>
      </div>
    );
  }
  return (
    <div className="monitor-detail-panel">
      <div className="monitor-detail-title">{content.title}</div>
      {content.subtitle && <div className="monitor-detail-subtitle">{content.subtitle}</div>}
      <div className="monitor-detail-rows">
        {content.rows.map((row) => (
          <div className="monitor-detail-row" key={row.label}>
            <span className="monitor-detail-row-label">{row.label}</span>
            <span className="monitor-detail-row-value">{row.value}</span>
            {row.percent !== undefined && <MonitorBar percent={row.percent} tone={row.tone ?? "blue"} />}
          </div>
        ))}
      </div>
      {content.linkTo && (
        <Link to={content.linkTo} className="monitor-detail-link">
          {content.linkLabel ?? "View full analysis"} <IconChevron width={10} height={10} />
        </Link>
      )}
    </div>
  );
}

type AtsToolKey = "sangian" | "vwm" | "dccs" | "cd";
const ATS_TOOL_COLUMNS: { key: AtsToolKey; label: string; tone: Tone }[] = [
  { key: "sangian", label: "SANGIAN", tone: "blue" },
  { key: "vwm", label: "VWM", tone: "teal" },
  { key: "dccs", label: "DCCS", tone: "violet" },
  { key: "cd", label: "CD", tone: "amber" },
];

/** Typed accessor for each tool's own `*_participant` field on
 * `AssessmentToolStatusResponse` - avoids a dynamic string-keyed index
 * (which does not type-check) while still reading the exact same
 * already-computed field, never a recalculation. */
function participantStatus(status: AssessmentToolStatusResponse, key: AtsToolKey) {
  switch (key) {
    case "sangian":
      return status.sangian_participant;
    case "vwm":
      return status.vwm_participant;
    case "dccs":
      return status.dccs_participant;
    case "cd":
      return status.cd_participant;
  }
}

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
function ParticipantAssessmentStatusPanel({
  status,
  expanded,
  onExpandedChange,
}: {
  status: AssessmentToolStatusResponse;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
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
      <button type="button" className="ats-common-toggle" onClick={() => onExpandedChange(!expanded)} aria-expanded={expanded}>
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

/** For one incomplete-core-battery child, the labels of the CORE_BATTERY_KEYS
 * instruments that child has NOT completed - reads only the existing
 * `instrument_status` booleans already on `RegistryChild`, no new status
 * computation. */
function remainingCoreLabels(child: RegistryChild): string[] {
  return CORE_BATTERY_COLUMNS.filter((col) => !child.instrument_status[col.key]).map((col) => col.label);
}

/** "Remaining Core Assessments" drawer - opened from the Core Assessment
 * Completion strip figure. Fetches the same Registry data the Participants
 * page already uses (`core_battery_complete=false`, i.e. exactly the
 * population NOT counted in `overview.core_assessment_count`), then reads
 * each child's own `instrument_status` for the 6 core instruments to show
 * what's still missing - no new backend endpoint, no new completion
 * definition. */
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

  const rows = useMemo(() => {
    if (!children) return [];
    return children
      .map((child) => ({ child, remaining: remainingCoreLabels(child) }))
      .filter((row) => row.remaining.length > 0);
  }, [children]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ child, remaining }) => {
      if (q && !child.redcap_child_id.toLowerCase().includes(q)) return false;
      if (instrumentFilter !== "all") {
        const col = CORE_BATTERY_COLUMNS.find((c) => c.key === instrumentFilter);
        if (!col || !remaining.includes(col.label)) return false;
      }
      return true;
    });
  }, [rows, query, instrumentFilter]);

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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string>("progress-overall");
  const [pstatusExpanded, setPstatusExpanded] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pstatusRef = useRef<HTMLDivElement | null>(null);
  const { version } = useRefresh();

  function openParticipantStatus() {
    setPstatusExpanded(true);
    requestAnimationFrame(() => pstatusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function handleExportExcel() {
    setExporting(true);
    setExportMessage(null);
    try {
      await exportActiveCases();
      setExportMessage("Excel export downloaded.");
    } catch (err) {
      setExportMessage(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    setExportMessage(null);
    try {
      await exportActiveCasesCsv();
      setExportMessage("CSV export downloaded.");
    } catch (err) {
      setExportMessage(`CSV export failed: ${(err as Error).message}`);
    } finally {
      setExportingCsv(false);
    }
  }

  useEffect(() => {
    setError(null);
    getOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
    // Secondary section - a failure here must not block or break the rest
    // of the Overview page (the strip/coverage sections are unaffected
    // either way).
    getAssessmentToolStatus()
      .then(setAssessmentToolStatus)
      .catch(() => setAssessmentToolStatus(null));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview) return <FullScreenLoader message="Loading ICMR Neurodevelopment Study Dashboard..." />;

  const sexData = [
    { label: "Male", count: overview.sex_distribution.male, tone: "blue" as Tone },
    { label: "Female", count: overview.sex_distribution.female, tone: "amber" as Tone },
    { label: "Unknown", count: overview.sex_distribution.unknown, tone: "teal" as Tone },
  ].filter((d) => d.count > 0);
  const sexTotal = sexData.reduce((sum, d) => sum + d.count, 0);

  const ageData = overview.age_distribution.map((b) => ({ label: b.label, count: b.count }));
  const ageTotal = ageData.reduce((sum, d) => sum + d.count, 0);

  const udaiData = overview.udai_pareek_category_distribution
    .map((c) => ({ label: c.code, count: c.count }))
    .sort((a, b) => b.count - a.count);
  const udaiClassified = udaiData.reduce((sum, d) => sum + d.count, 0);

  // --- Right-hand detail panel content, keyed by whichever row was last
  // selected in the left column. Every figure below is a direct re-read of
  // an already-computed value (overview.*, assessmentToolStatus.*) - no new
  // calculation is introduced for the detail view.
  const detailContent: Record<string, DetailContent> = {
    "progress-overall": assessmentToolStatus
      ? {
          title: "Overall Assessment Progress",
          subtitle: "Administration status only - not outcome data",
          rows: [
            {
              label: "Completed",
              value: `${assessmentToolStatus.overall_participant.done_count} / ${assessmentToolStatus.overall_participant.total}`,
              percent: assessmentToolStatus.overall_participant.percent,
              tone: "blue",
            },
            {
              label: "Remaining",
              value: (assessmentToolStatus.overall_participant.total - assessmentToolStatus.overall_participant.done_count).toLocaleString(),
            },
            { label: "Completion", value: `${assessmentToolStatus.overall_participant.percent}%` },
          ],
          linkTo: "/assessment-tool-status",
          linkLabel: "View Remaining Assessments →",
        }
      : { title: "Overall Assessment Progress", rows: [] },
    "study-profile": {
      title: "Study Profile",
      subtitle: `${overview.total_registered} registered children`,
      rows: [
        ...sexData.map((d) => ({ label: `Sex: ${d.label}`, value: `${d.count} (${percentOf(d.count, sexTotal)}%)`, percent: percentOf(d.count, sexTotal), tone: d.tone })),
        ...ageData.map((d) => ({ label: `Age: ${d.label}`, value: `${d.count} (${percentOf(d.count, ageTotal)}%)`, percent: percentOf(d.count, ageTotal), tone: "teal" as Tone })),
      ],
    },
    "ses-category": {
      title: "SES Category (Udai Pareek)",
      subtitle: `${udaiClassified} of ${overview.total_registered} registered children have an SES classification`,
      rows: udaiData.map((d) => ({ label: d.label, value: `${d.count} (${percentOf(d.count, udaiClassified)}%)`, percent: percentOf(d.count, udaiClassified), tone: "violet" as Tone })),
    },
  };

  ATS_TOOL_COLUMNS.forEach((col) => {
    if (!assessmentToolStatus) return;
    const s = participantStatus(assessmentToolStatus, col.key);
    detailContent[`progress-${col.key}`] = {
      title: col.label,
      subtitle: "Administration status only - not outcome data",
      rows: [
        { label: "Completed", value: `${s.done_count} / ${s.total}`, percent: s.percent, tone: col.tone },
        { label: "Remaining", value: (s.total - s.done_count).toLocaleString() },
        { label: "Completion", value: `${s.percent}%` },
      ],
      linkTo: "/assessment-tool-status",
      linkLabel: "View participants →",
    };
  });

  OVERVIEW_INSTRUMENTS.forEach((instrument) => {
    const coverage = overview.all_instrument_coverage.find((c) => c.key === instrument.key);
    const completed = coverage?.completed_count ?? 0;
    const percent = coverage?.percent_of_registered ?? 0;
    detailContent[`coverage-${instrument.key}`] = {
      title: instrument.name,
      subtitle: instrument.purpose,
      rows: [{ label: "Completed", value: `${completed}/${overview.total_registered} (${percent}%)`, percent, tone: "blue" }],
      linkTo: instrument.route,
      linkLabel: "View full analysis",
    };
  });

  return (
    <section className="overview-page">
      <div className="stat-strip" title={`Original enrolled cohort: ${STUDY_ORIGINAL_ENROLLMENT}`}>
        <div className="stat-block">
          <span className="stat-block-label">Current Active Cases</span>
          <span className="stat-block-value">{overview.total_registered.toLocaleString()}</span>
          <span className="stat-block-footnote">Children in analytical population</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Original Cohort</span>
          <span className="stat-block-value">{STUDY_ORIGINAL_ENROLLMENT.toLocaleString()}</span>
          <span className="stat-block-footnote">
            {STUDY_MIGRATED_COUNT} migrated · {STUDY_DECEASED_COUNT} deceased
          </span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Assessment Progress</span>
          <span className="stat-block-value">
            {assessmentToolStatus ? `${assessmentToolStatus.overall_participant.done_count} / ${assessmentToolStatus.overall_participant.total}` : "—"}
          </span>
          {assessmentToolStatus && <MonitorBar percent={assessmentToolStatus.overall_participant.percent} tone="violet" />}
          {assessmentToolStatus && <span className="stat-block-footnote">{assessmentToolStatus.overall_participant.percent}%</span>}
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Remaining Assessments</span>
          <span className="stat-block-value">
            {assessmentToolStatus
              ? (assessmentToolStatus.overall_participant.total - assessmentToolStatus.overall_participant.done_count).toLocaleString()
              : "—"}
          </span>
          <span className="stat-block-footnote">Children pending completion</span>
        </div>
        <button type="button" className="stat-block stat-block-clickable" onClick={() => setRemainingOpen(true)}>
          <span className="stat-block-label">Core Assessment Completion</span>
          <span className="stat-block-value">
            {overview.core_assessment_count} / {overview.total_registered}
          </span>
          <MonitorBar percent={overview.core_assessment_percent} tone="amber" />
          <span className="stat-block-footnote">{overview.core_assessment_percent}% · View remaining →</span>
        </button>
      </div>

      <CoreRemainingDrawer
        isOpen={remainingOpen}
        onClose={() => setRemainingOpen(false)}
        totalRegistered={overview.total_registered}
        coreCompleteCount={overview.core_assessment_count}
      />

      <div className="monitor-layout">
        <div className="monitor-main">
          {assessmentToolStatus && (
            <div className="monitor-section">
              <div className="monitor-section-head">
                <span className="monitor-section-title">Assessment Progress</span>
                <span className="monitor-section-note">Administration status only - not outcome data</span>
              </div>
              <MetricRow
                label="Overall Assessment"
                valueText={`${assessmentToolStatus.overall_participant.done_count} / ${assessmentToolStatus.overall_participant.total} · ${assessmentToolStatus.overall_participant.percent}%`}
                percent={assessmentToolStatus.overall_participant.percent}
                tone="blue"
                selected={detailKey === "progress-overall"}
                onSelect={() => setDetailKey("progress-overall")}
              />
              {ATS_TOOL_COLUMNS.map((col) => {
                const s = participantStatus(assessmentToolStatus, col.key);
                return (
                  <MetricRow
                    key={col.key}
                    label={col.label}
                    valueText={`${s.done_count} / ${s.total} · ${s.percent}%`}
                    percent={s.percent}
                    tone={col.tone}
                    selected={detailKey === `progress-${col.key}`}
                    onSelect={() => setDetailKey(`progress-${col.key}`)}
                  />
                );
              })}
              <div ref={pstatusRef}>
                <ParticipantAssessmentStatusPanel status={assessmentToolStatus} expanded={pstatusExpanded} onExpandedChange={setPstatusExpanded} />
              </div>
            </div>
          )}

          <div className="monitor-section">
            <div className="monitor-section-head">
              <span className="monitor-section-title">Study Profile</span>
              <span className="monitor-section-note">Who is registered in the study</span>
            </div>

            <div className="study-profile-columns">
              <div className="study-profile-col">
                <div className="monitor-subgroup-label">Sex</div>
                {sexData.map((d) => (
                  <MetricRow
                    key={d.label}
                    label={d.label}
                    valueText={`${d.count.toLocaleString()} (${percentOf(d.count, sexTotal)}%)`}
                    percent={percentOf(d.count, sexTotal)}
                    tone={d.tone}
                    selected={detailKey === "study-profile"}
                    onSelect={() => setDetailKey("study-profile")}
                  />
                ))}
              </div>

              <div className="study-profile-col">
                <div className="monitor-subgroup-label">Age</div>
                {ageData.map((d) => (
                  <MetricRow
                    key={d.label}
                    label={d.label}
                    valueText={`${d.count.toLocaleString()} (${percentOf(d.count, ageTotal)}%)`}
                    percent={percentOf(d.count, ageTotal)}
                    tone="teal"
                    selected={detailKey === "study-profile"}
                    onSelect={() => setDetailKey("study-profile")}
                  />
                ))}
              </div>

              <div className="study-profile-col">
                <div className="monitor-subgroup-label">SES Category</div>
                {udaiData.map((d) => (
                  <MetricRow
                    key={d.label}
                    label={d.label}
                    valueText={`${d.count.toLocaleString()} (${percentOf(d.count, udaiClassified)}%)`}
                    percent={percentOf(d.count, udaiClassified)}
                    tone="violet"
                    selected={detailKey === "ses-category"}
                    onSelect={() => setDetailKey("ses-category")}
                  />
                ))}
                <p className="monitor-section-footnote">
                  {udaiClassified} of {overview.total_registered} classified
                </p>
              </div>
            </div>
          </div>

          <div className="monitor-section">
            <div className="monitor-section-head">
              <span className="monitor-section-title">Assessment Coverage</span>
              <span className="monitor-section-note">Each of the 8 currently-mapped study instruments, independently calculated</span>
            </div>
            {OVERVIEW_INSTRUMENTS.map((instrument) => {
              const coverage = overview.all_instrument_coverage.find((c) => c.key === instrument.key);
              const completed = coverage?.completed_count ?? 0;
              const percent = coverage?.percent_of_registered ?? 0;
              return (
                <MetricRow
                  key={instrument.key}
                  label={instrument.name}
                  valueText={`${completed}/${overview.total_registered} (${percent}%)`}
                  percent={percent}
                  tone="blue"
                  selected={detailKey === `coverage-${instrument.key}`}
                  onSelect={() => setDetailKey(`coverage-${instrument.key}`)}
                />
              );
            })}
          </div>
        </div>

        <div className="monitor-detail">
          <DetailPanel content={detailContent[detailKey] ?? null} />

          <div className="monitor-quick-actions">
            <div className="monitor-quick-actions-title">Quick Actions</div>
            {assessmentToolStatus && (
              <button type="button" className="monitor-quick-action" onClick={openParticipantStatus}>
                View Participant Assessment Status
              </button>
            )}
            <button type="button" className="monitor-quick-action" onClick={() => void handleExportExcel()} disabled={exporting}>
              {exporting ? "Exporting…" : "Export Active Cases (Excel)"}
            </button>
            <button type="button" className="monitor-quick-action" onClick={() => void handleExportCsv()} disabled={exportingCsv}>
              {exportingCsv ? "Exporting…" : "Export Active Cases (CSV)"}
            </button>
            <button type="button" className="monitor-quick-action" onClick={() => setRemainingOpen(true)}>
              View Remaining Assessments
            </button>
            {exportMessage && <p className="monitor-section-footnote">{exportMessage}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
