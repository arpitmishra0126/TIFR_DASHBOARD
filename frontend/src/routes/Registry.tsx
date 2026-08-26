import { useEffect, useState } from "react";

import { getRegistry } from "../api/dashboard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import type { RegistryResponse } from "../types/liveDashboard";

const PAGE_SIZE = 25;

export default function Registry() {
  const [search, setSearch] = useState("");
  const [sex, setSex] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getRegistry({ search: search || undefined, sex: sex || undefined, limit: PAGE_SIZE, offset })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [search, sex, offset]);

  return (
    <section>
      <PageHeader
        eyebrow="Study Population"
        title="Participants"
        subtitle="Approved registry identifiers only — parent/family names and contact numbers are not exposed here."
      />

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

      {error && <p className="error-text">Could not reach backend: {error}</p>}
      {!error && !data && <p className="loading-text">Loading…</p>}

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
