import { useEffect, useState } from "react";

import { exportActiveCases, exportActiveCasesCsv, getRegistry } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { RegistryResponse } from "../types/liveDashboard";

const PAGE_SIZE = 25;

export default function Registry() {
  const [search, setSearch] = useState("");
  const [sex, setSex] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportCsvMessage, setExportCsvMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setError(null);
    getRegistry({ search: search || undefined, sex: sex || undefined, limit: PAGE_SIZE, offset })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [search, sex, offset, version, retryCount]);

  async function handleExport() {
    setExporting(true);
    setExportMessage(null);
    try {
      await exportActiveCases();
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
      await exportActiveCasesCsv();
      setExportCsvMessage({ kind: "success", text: "CSV export downloaded." });
    } catch (err) {
      setExportCsvMessage({ kind: "error", text: `CSV export failed: ${(err as Error).message}` });
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Study Population"
        title="Participants"
        subtitle="Approved registry identifiers only — parent/family names and contact numbers are not exposed here."
      />

      <div className="export-bar">
        <button type="button" className="export-button" onClick={() => void handleExport()} disabled={exporting} aria-busy={exporting}>
          {exporting ? "Generating export…" : "Export Active Cases (Excel)"}
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
          {exportingCsv ? "Generating export…" : "Export Active Cases (CSV)"}
        </button>
        {exportCsvMessage && (
          <span className={exportCsvMessage.kind === "success" ? "export-success-text" : "error-text"}>{exportCsvMessage.text}</span>
        )}
      </div>

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
      </div>

      {error && <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />}
      {!error && !data && <StudyDataLoader label="Loading participant registry" subLabel="Connecting to live REDCap data…" />}

      {data && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Child ID</th>
                <th>Sex</th>
                <th>Age</th>
                <th>Village</th>
                <th>Status</th>
                <th>Visit Date</th>
                <th>Registration</th>
              </tr>
            </thead>
            <tbody>
              {data.children.map((child) => (
                <tr key={child.redcap_child_id}>
                  <td>{child.redcap_child_id}</td>
                  <td>{child.sex ?? "—"}</td>
                  <td>{child.age_years ?? "—"}</td>
                  <td>{child.village ?? "—"}</td>
                  <td>{child.child_status ?? "—"}</td>
                  <td>{child.visit_date ?? "—"}</td>
                  <td>
                    <StatusBadge
                      label={child.registration_complete ? "Complete" : "Incomplete"}
                      tone={child.registration_complete ? "good" : "neutral"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
    </section>
  );
}
