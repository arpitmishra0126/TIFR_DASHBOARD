import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";

import { exportActiveCases, exportActiveCasesCsv, getRegistry, type RegistryFilterQuery } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import { IconArrowUpRight, IconCalendar, IconClipboardAlert, IconClipboardX, IconFlag } from "../components/icons";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import { usePopulation } from "../hooks/usePopulation";
import { distinctVillages } from "../lib/populationAnalytics";
import type { RegistryChild, RegistryResponse } from "../types/liveDashboard";

const PAGE_SIZE = 25;

// Instrument status columns shown in the participant table and detail panel,
// in the same pipeline order as ALL_INSTRUMENTS/CORE_BATTERY_INSTRUMENTS
// (backend/app/ingestion/live_field_map.py) - registration is not repeated
// here since it already has its own dedicated column.
const INSTRUMENT_COLUMNS: { key: string; short: string; label: string }[] = [
  { key: "ses", short: "SES", label: "SES" },
  { key: "dseq", short: "DSEQ", label: "DSEQ" },
  { key: "child_illness_history", short: "CHH", label: "Child Illness History" },
  { key: "paq_a", short: "PAQ-C", label: "PAQ-C" },
  { key: "dietary_intake", short: "Diet", label: "Dietary Intake" },
  { key: "ssrs_parent", short: "SSRS-P", label: "SSRS Parent" },
  { key: "ssrs_child", short: "SSRS-C", label: "SSRS Child" },
  { key: "ssrs_teacher", short: "SSRS-T", label: "SSRS Teacher" },
];

type QuickQueryKey = "follow_up" | "incomplete" | "missing_instrument" | "recent_visits" | "data_review";

const QUICK_QUERIES: {
  key: QuickQueryKey;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: "blue" | "amber" | "green" | "violet" | "coral";
}[] = [
  {
    key: "follow_up",
    label: "Needs Follow-up",
    description: "Cleared a pipeline stage and is due for the next assessment.",
    icon: IconArrowUpRight,
    tone: "blue",
  },
  {
    key: "incomplete",
    label: "Incomplete Assessments",
    description: "Core Study Assessments not yet fully complete.",
    icon: IconClipboardAlert,
    tone: "amber",
  },
  {
    key: "missing_instrument",
    label: "Missing Assessment",
    description: "Participants without a chosen instrument on file.",
    icon: IconClipboardX,
    tone: "green",
  },
  {
    key: "recent_visits",
    label: "Recent Visits",
    description: "Filter participants by recorded visit date range.",
    icon: IconCalendar,
    tone: "violet",
  },
  {
    key: "data_review",
    label: "Data Review",
    description: "Incomplete demographic profile - missing sex, village, or age.",
    icon: IconFlag,
    tone: "coral",
  },
];

const ANY_CORE_INSTRUMENT = "";

function InstrumentDot({ complete }: { complete: boolean }) {
  return <span className={`instrument-dot ${complete ? "instrument-dot-complete" : "instrument-dot-pending"}`}>{complete ? "✓" : "–"}</span>;
}

function progressionTone(stage: RegistryChild["progression_stage"]): "good" | "neutral" | "warning" {
  if (stage === "SSRS Teacher") return "good";
  if (stage === "Registered") return "neutral";
  return "warning";
}

// Display-only relabel - the underlying progression_stage value from the
// backend (and the progressionStage query param sent back to it) is
// unchanged; only the on-screen wording is remapped here.
function displayStage(stage: string): string {
  return stage.replace("Core Assessment Battery", "Core Study Assessments");
}

export default function Registry() {
  const [search, setSearch] = useState("");
  const [sex, setSex] = useState("");
  const [village, setVillage] = useState("");
  const [quickQuery, setQuickQuery] = useState<QuickQueryKey | null>(null);
  const [missingInstrument, setMissingInstrument] = useState(INSTRUMENT_COLUMNS[0].key);
  const [incompleteInstrument, setIncompleteInstrument] = useState(ANY_CORE_INSTRUMENT);
  const [visitFrom, setVisitFrom] = useState("");
  const [visitTo, setVisitTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedChild, setSelectedChild] = useState<RegistryChild | null>(null);
  const { version } = useRefresh();
  const { children: allChildren } = usePopulation();

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportCsvMessage, setExportCsvMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const villageOptions = useMemo(() => (allChildren ? distinctVillages(allChildren) : []), [allChildren]);

  const activeQuery: RegistryFilterQuery = useMemo(() => {
    const query: RegistryFilterQuery = {
      search: search || undefined,
      sex: sex || undefined,
      village: village || undefined,
    };
    if (quickQuery === "follow_up") {
      // Cumulative-pipeline definition: cleared the Core Study Assessments
      // gate but hasn't yet cleared SSRS Teacher - i.e. eligible/pending for
      // its next stage. Uses only the same completion fields as the
      // Assessment Progress funnel - no clinical/date rule (e.g. an "SES +
      // 15 days" window) invented. The literal value below is the backend's
      // progression_stage string (live_dashboard_service.py) - display-only
      // relabeling happens in displayStage(), never in this query param.
      query.progressionStage = "Core Assessment Battery,SSRS Child";
    } else if (quickQuery === "incomplete") {
      // Default (no instrument chosen) is the blanket Core Study Assessments
      // gate; choosing an instrument narrows to that one specific
      // instrument via the same missing-instrument filter as Missing
      // Assessment - no new backend logic either way.
      if (incompleteInstrument) {
        query.missingInstrument = incompleteInstrument;
      } else {
        query.coreBatteryComplete = false;
      }
    } else if (quickQuery === "missing_instrument") {
      query.missingInstrument = missingInstrument;
    } else if (quickQuery === "recent_visits") {
      query.visitDateFrom = visitFrom || undefined;
      query.visitDateTo = visitTo || undefined;
    } else if (quickQuery === "data_review") {
      query.dataReview = true;
    }
    return query;
  }, [search, sex, village, quickQuery, missingInstrument, incompleteInstrument, visitFrom, visitTo]);

  const isFiltered = Boolean(search || sex || village || quickQuery);
  const activeQueryDef = useMemo(() => QUICK_QUERIES.find((q) => q.key === quickQuery) ?? null, [quickQuery]);

  // The single instrument column an instrument-specific query is scoped to -
  // used to call out the matching column in the table and to phrase the
  // result line in terms of that instrument, not just a raw count.
  const highlightedInstrument = useMemo(() => {
    if (quickQuery === "incomplete" && incompleteInstrument) {
      return INSTRUMENT_COLUMNS.find((col) => col.key === incompleteInstrument) ?? null;
    }
    if (quickQuery === "missing_instrument") {
      return INSTRUMENT_COLUMNS.find((col) => col.key === missingInstrument) ?? null;
    }
    return null;
  }, [quickQuery, incompleteInstrument, missingInstrument]);

  useEffect(() => {
    setError(null);
    getRegistry({ ...activeQuery, limit: PAGE_SIZE, offset })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [activeQuery, offset, version, retryCount]);

  function selectQuickQuery(key: QuickQueryKey) {
    setOffset(0);
    setQuickQuery((current) => (current === key ? null : key));
  }

  function resetAll() {
    setSearch("");
    setSex("");
    setVillage("");
    setQuickQuery(null);
    setIncompleteInstrument(ANY_CORE_INSTRUMENT);
    setVisitFrom("");
    setVisitTo("");
    setOffset(0);
  }

  async function handleExport() {
    setExporting(true);
    setExportMessage(null);
    try {
      await exportActiveCases(activeQuery);
      setExportMessage({ kind: "success", text: "Export downloaded." });
    } catch (err) {
      setExportMessage({ kind: "error", text: `Export failed: ${(err as Error).message}` });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    setExportCsvMessage(null);
    try {
      await exportActiveCasesCsv(activeQuery);
      setExportCsvMessage({ kind: "success", text: "CSV export downloaded." });
    } catch (err) {
      setExportCsvMessage({ kind: "error", text: `CSV export failed: ${(err as Error).message}` });
    } finally {
      setExportingCsv(false);
    }
  }

  const exportLabel = data && isFiltered ? `matching participants (${data.total})` : "Active Cases";

  return (
    <section>
      <PageHeader
        eyebrow="Study Operations"
        title="Participant Registry"
        subtitle="Find, filter, and act on participant records - approved identifiers only, no parent/family names or contact numbers."
      />

      <SectionHeader title="Quick Queries" note="Actionable filters, not KPI cards" />
      <div className="quick-query-grid">
        {QUICK_QUERIES.map((q) => {
          const Icon = q.icon;
          const active = quickQuery === q.key;
          return (
            <button
              key={q.key}
              type="button"
              className={`quick-query-card quick-query-tone-${q.tone} ${active ? "quick-query-card-active" : ""}`}
              aria-pressed={active}
              onClick={() => selectQuickQuery(q.key)}
            >
              <span className="quick-query-card-icon">
                <Icon width={20} height={20} />
              </span>
              <span className="quick-query-card-title">{q.label}</span>
              <span className="quick-query-card-desc">{q.description}</span>
            </button>
          );
        })}
      </div>

      {quickQuery && activeQueryDef && (
        <div className={`query-control-panel quick-query-tone-${activeQueryDef.tone}`}>
          <div className="query-control-header">
            <span className="query-control-icon">
              <activeQueryDef.icon width={18} height={18} />
            </span>
            <div className="query-control-heading">
              <div className="query-control-title">{activeQueryDef.label}</div>
              <div className="query-control-explain">
                {quickQuery === "follow_up" &&
                  "Participants who completed the Core Study Assessments and/or SSRS Child, and are due for their next stage (SSRS Child or SSRS Teacher)."}
                {quickQuery === "incomplete" &&
                  (incompleteInstrument
                    ? `Showing participants who have not completed ${INSTRUMENT_COLUMNS.find((c) => c.key === incompleteInstrument)?.label ?? "the selected instrument"}.`
                    : "Showing participants who have not completed all six Core Study Assessments instruments.")}
                {quickQuery === "missing_instrument" && "Showing participants who have not completed the selected instrument."}
                {quickQuery === "recent_visits" && "Filters participants by their recorded visit date range."}
                {quickQuery === "data_review" &&
                  "Showing registered participants with an incomplete demographic profile - missing sex, village, or age."}
              </div>
            </div>
            <button type="button" className="quick-query-clear" onClick={() => setQuickQuery(null)}>
              Clear query
            </button>
          </div>

          {(quickQuery === "incomplete" || quickQuery === "missing_instrument" || quickQuery === "recent_visits") && (
            <div className="query-control-body">
              {quickQuery === "incomplete" && (
                <>
                  <span className="filter-bar-label">Instrument</span>
                  <select
                    value={incompleteInstrument}
                    onChange={(e) => {
                      setOffset(0);
                      setIncompleteInstrument(e.target.value);
                    }}
                  >
                    <option value={ANY_CORE_INSTRUMENT}>Any Core Study Assessments instrument</option>
                    {INSTRUMENT_COLUMNS.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {quickQuery === "missing_instrument" && (
                <>
                  <span className="filter-bar-label">Instrument</span>
                  <select
                    value={missingInstrument}
                    onChange={(e) => {
                      setOffset(0);
                      setMissingInstrument(e.target.value);
                    }}
                  >
                    {INSTRUMENT_COLUMNS.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {quickQuery === "recent_visits" && (
                <>
                  <span className="filter-bar-label">Visit date</span>
                  <input
                    type="date"
                    value={visitFrom}
                    onChange={(e) => {
                      setOffset(0);
                      setVisitFrom(e.target.value);
                    }}
                  />
                  <span className="query-control-to">to</span>
                  <input
                    type="date"
                    value={visitTo}
                    onChange={(e) => {
                      setOffset(0);
                      setVisitTo(e.target.value);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="filter-bar">
        <span className="filter-bar-label">Filter</span>
        <input
          placeholder="Search child ID…"
          value={search}
          onChange={(e) => {
            setOffset(0);
            setSearch(e.target.value);
          }}
        />
        <select
          value={sex}
          onChange={(e) => {
            setOffset(0);
            setSex(e.target.value);
          }}
        >
          <option value="">All sexes</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <select
          value={village}
          onChange={(e) => {
            setOffset(0);
            setVillage(e.target.value);
          }}
        >
          <option value="">All villages</option>
          {villageOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button className="filter-bar-reset" disabled={!isFiltered} onClick={resetAll}>
          Reset
        </button>
      </div>

      {data && (
        <div className="registry-result-line">
          <span>
            {isFiltered ? (
              <>
                <strong>{data.total}</strong> matching participant{data.total === 1 ? "" : "s"}
              </>
            ) : (
              <>
                <strong>{data.total}</strong> registered participants
              </>
            )}
          </span>

          {highlightedInstrument && (
            <div className={`registry-result-context quick-query-tone-${activeQueryDef?.tone ?? "blue"}`}>
              <span className="registry-result-explain">
                {data.total} participant{data.total === 1 ? "" : "s"} with {highlightedInstrument.label} not completed.
              </span>
              <span className="active-filter-chip">{highlightedInstrument.short}: Not completed</span>
            </div>
          )}
        </div>
      )}

      <div className="export-bar">
        <button type="button" className="export-button" onClick={() => void handleExport()} disabled={exporting} aria-busy={exporting}>
          {exporting ? "Generating export…" : `Export ${exportLabel} (Excel)`}
        </button>
        {exportMessage && (
          <span className={exportMessage.kind === "success" ? "export-success-text" : "error-text"}>{exportMessage.text}</span>
        )}

        <button
          type="button"
          className="export-button"
          onClick={() => void handleExportCsv()}
          disabled={exportingCsv}
          aria-busy={exportingCsv}
        >
          {exportingCsv ? "Generating export…" : `Export ${exportLabel} (CSV)`}
        </button>
        {exportCsvMessage && (
          <span className={exportCsvMessage.kind === "success" ? "export-success-text" : "error-text"}>{exportCsvMessage.text}</span>
        )}
      </div>

      {error && <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />}
      {!error && !data && <StudyDataLoader label="Loading participant registry" subLabel="Connecting to live REDCap data…" />}

      {data && data.children.length === 0 && (
        <div className="table-card registry-empty-state">
          <p>No participants match the current filters/query.</p>
          <button type="button" className="filter-bar-reset" onClick={resetAll}>
            Reset filters
          </button>
        </div>
      )}

      {data && data.children.length > 0 && (
        <div className={`table-card registry-table-card ${highlightedInstrument ? `quick-query-tone-${activeQueryDef?.tone ?? "blue"}` : ""}`}>
          <div className="registry-table-scroll">
            <table className="data-table registry-data-table">
              <thead>
                <tr>
                  <th>Child ID</th>
                  <th>Sex</th>
                  <th>Age</th>
                  <th>Village</th>
                  {INSTRUMENT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      title={col.label}
                      className={highlightedInstrument?.key === col.key ? "registry-instrument-col-highlighted" : undefined}
                    >
                      {col.short}
                    </th>
                  ))}
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {data.children.map((child) => (
                  <tr key={child.redcap_child_id} className="registry-row" onClick={() => setSelectedChild(child)}>
                    <td className="registry-child-id">{child.redcap_child_id}</td>
                    <td>{child.sex ?? "-"}</td>
                    <td>{child.age_years ?? "-"}</td>
                    <td>{child.village ?? "-"}</td>
                    {INSTRUMENT_COLUMNS.map((col) => (
                      <td key={col.key} className={highlightedInstrument?.key === col.key ? "registry-instrument-col-highlighted" : undefined}>
                        <InstrumentDot complete={child.instrument_status[col.key] ?? false} />
                      </td>
                    ))}
                    <td>
                      <StatusBadge label={displayStage(child.progression_stage)} tone={progressionTone(child.progression_stage)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-controls">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
            </span>
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Previous
            </button>
            <button disabled={offset + PAGE_SIZE >= data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next
            </button>
          </div>
        </div>
      )}

      {selectedChild && <ParticipantDetailPanel child={selectedChild} onClose={() => setSelectedChild(null)} />}
    </section>
  );
}

function ParticipantDetailPanel({ child, onClose }: { child: RegistryChild; onClose: () => void }) {
  const completedCount = INSTRUMENT_COLUMNS.filter((col) => child.instrument_status[col.key]).length;

  return (
    <div className="registry-detail-overlay" onClick={onClose}>
      <div className="registry-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="registry-detail-header">
          <div>
            <div className="registry-detail-id">{child.redcap_child_id}</div>
            <div className="registry-detail-sub">
              {child.sex ?? "Sex unknown"} · {child.age_years !== null ? `${child.age_years} yrs` : "Age unknown"} ·{" "}
              {child.village ?? "Village unknown"}
            </div>
          </div>
          <button type="button" className="registry-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="registry-detail-body">
          <div className="registry-detail-section-label">Participant Information</div>
          <div className="registry-detail-info">
            <div className="registry-detail-row">
              <span>Registration</span>
              <StatusBadge label={child.registration_complete ? "Complete" : "Incomplete"} tone={child.registration_complete ? "good" : "neutral"} />
            </div>
            <div className="registry-detail-row">
              <span>Status</span>
              <span>{child.child_status ?? "-"}</span>
            </div>
            <div className="registry-detail-row">
              <span>Visit date</span>
              <span>{child.visit_date ?? "-"}</span>
            </div>
            <div className="registry-detail-row">
              <span>Pipeline stage</span>
              <StatusBadge label={displayStage(child.progression_stage)} tone={progressionTone(child.progression_stage)} />
            </div>
          </div>

          <div className="registry-detail-divider" />

          <div className="registry-detail-section-head">
            <span className="registry-detail-section-label">Assessment Status</span>
            <span className="registry-detail-section-count">
              {completedCount}/{INSTRUMENT_COLUMNS.length} completed
            </span>
          </div>

          <div className="registry-detail-instrument-grid">
            {INSTRUMENT_COLUMNS.map((col) => {
              const complete = child.instrument_status[col.key] ?? false;
              return (
                <div key={col.key} className={`registry-detail-instrument-tile ${complete ? "registry-detail-instrument-tile-complete" : ""}`}>
                  <InstrumentDot complete={complete} />
                  <div className="registry-detail-instrument-text">
                    <span className="registry-detail-instrument-name">{col.label}</span>
                    <span className="registry-detail-instrument-status">{complete ? "Completed" : "Not completed"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
