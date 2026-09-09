import { useEffect, useMemo, useState } from "react";

import { exportActiveCases, exportActiveCasesCsv, getRegistry, type RegistryFilterQuery } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
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
  { key: "paq_a", short: "PAQ-A", label: "PAQ-A" },
  { key: "dietary_intake", short: "Diet", label: "Dietary Intake" },
  { key: "ssrs_parent", short: "SSRS-P", label: "SSRS Parent" },
  { key: "ssrs_child", short: "SSRS-C", label: "SSRS Child" },
  { key: "ssrs_teacher", short: "SSRS-T", label: "SSRS Teacher" },
];

type QuickQueryKey = "follow_up" | "incomplete" | "missing_instrument" | "window" | "data_review";

const QUICK_QUERIES: { key: QuickQueryKey; label: string; hint: string }[] = [
  { key: "follow_up", label: "Assessment Follow-up", hint: "Cleared a pipeline stage - eligible for the next one" },
  { key: "incomplete", label: "Incomplete Assessments", hint: "Core Assessment Battery not yet complete" },
  { key: "missing_instrument", label: "Missing Instrument", hint: "Participants without a chosen instrument" },
  { key: "window", label: "Follow-up Window", hint: "Filter by visit date range" },
  { key: "data_review", label: "Data Review", hint: "Incomplete demographic profile (sex/village/age)" },
];

function InstrumentDot({ complete }: { complete: boolean }) {
  return <span className={`instrument-dot ${complete ? "instrument-dot-complete" : "instrument-dot-pending"}`}>{complete ? "✓" : "–"}</span>;
}

function progressionTone(stage: RegistryChild["progression_stage"]): "good" | "neutral" | "warning" {
  if (stage === "SSRS Teacher") return "good";
  if (stage === "Registered") return "neutral";
  return "warning";
}

export default function Registry() {
  const [search, setSearch] = useState("");
  const [sex, setSex] = useState("");
  const [village, setVillage] = useState("");
  const [quickQuery, setQuickQuery] = useState<QuickQueryKey | null>(null);
  const [missingInstrument, setMissingInstrument] = useState(INSTRUMENT_COLUMNS[0].key);
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
      // Cumulative-pipeline definition: cleared the Core Assessment Battery
      // gate but hasn't yet cleared SSRS Teacher - i.e. eligible/pending for
      // its next stage. Uses only the same completion fields as the
      // Assessment Progress funnel - no clinical/date rule invented.
      query.progressionStage = "Core Assessment Battery,SSRS Child";
    } else if (quickQuery === "incomplete") {
      query.coreBatteryComplete = false;
    } else if (quickQuery === "missing_instrument") {
      query.missingInstrument = missingInstrument;
    } else if (quickQuery === "window") {
      query.visitDateFrom = visitFrom || undefined;
      query.visitDateTo = visitTo || undefined;
    } else if (quickQuery === "data_review") {
      query.dataReview = true;
    }
    return query;
  }, [search, sex, village, quickQuery, missingInstrument, visitFrom, visitTo]);

  const isFiltered = Boolean(search || sex || village || quickQuery);

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
      <div className="quick-query-bar">
        {QUICK_QUERIES.map((q) => (
          <button
            key={q.key}
            type="button"
            className={`quick-query-chip ${quickQuery === q.key ? "quick-query-chip-active" : ""}`}
            title={q.hint}
            onClick={() => selectQuickQuery(q.key)}
          >
            {q.label}
          </button>
        ))}
        {quickQuery && (
          <button type="button" className="quick-query-clear" onClick={() => setQuickQuery(null)}>
            Clear query
          </button>
        )}
      </div>

      {quickQuery === "missing_instrument" && (
        <div className="quick-query-detail">
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
          <span className="quick-query-detail-note">Showing participants who have not completed this instrument.</span>
        </div>
      )}

      {quickQuery === "window" && (
        <div className="quick-query-detail">
          <span className="filter-bar-label">Visit date</span>
          <input
            type="date"
            value={visitFrom}
            onChange={(e) => {
              setOffset(0);
              setVisitFrom(e.target.value);
            }}
          />
          <span>to</span>
          <input
            type="date"
            value={visitTo}
            onChange={(e) => {
              setOffset(0);
              setVisitTo(e.target.value);
            }}
          />
          <span className="quick-query-detail-note">Filters on the recorded visit date field.</span>
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
        <div className="table-card registry-table-card">
          <div className="registry-table-scroll">
            <table className="data-table registry-data-table">
              <thead>
                <tr>
                  <th>Child ID</th>
                  <th>Sex</th>
                  <th>Age</th>
                  <th>Village</th>
                  {INSTRUMENT_COLUMNS.map((col) => (
                    <th key={col.key} title={col.label}>
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
                      <td key={col.key}>
                        <InstrumentDot complete={child.instrument_status[col.key] ?? false} />
                      </td>
                    ))}
                    <td>
                      <StatusBadge label={child.progression_stage} tone={progressionTone(child.progression_stage)} />
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
            <StatusBadge label={child.progression_stage} tone={progressionTone(child.progression_stage)} />
          </div>

          <div className="registry-detail-divider" />

          <div className="registry-detail-instruments">
            {INSTRUMENT_COLUMNS.map((col) => (
              <div className="registry-detail-instrument-row" key={col.key}>
                <span>{col.label}</span>
                <InstrumentDot complete={child.instrument_status[col.key] ?? false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
