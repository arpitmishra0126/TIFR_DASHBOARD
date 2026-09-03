import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { ConditionIndicator, HealthScreeningResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function ConditionTable({ title, rows }: { title: string; rows: ConditionIndicator[] }) {
  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>{title}</th>
            <th>Yes</th>
            <th>No</th>
            <th>Don't know</th>
            <th>Valid N</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.label}>
              <td>{c.label}</td>
              <td>
                {c.yes_count} ({c.percent_yes}%)
              </td>
              <td>{c.no_count}</td>
              <td>{c.dont_know_count}</td>
              <td>{c.valid_n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HealthScreening() {
  const [data, setData] = useState<HealthScreeningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getHealthScreening()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading assessment data" subLabel="Connecting to live REDCap data…" />;

  const { completion } = data;

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Child Illness History"
        subtitle="Child Illness History — live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader
        title="Reported conditions and indicators"
        note="Percentages use each item's own valid respondents (children who actually answered that question), not the full registered cohort."
      />
      <div className="chart-grid two-col">
        <ConditionTable title="Reported Health Conditions, n (%)" rows={data.named_conditions} />
        <ConditionTable title="Reported Health and Medical-History Indicators, n (%)" rows={data.general_flags} />
      </div>
    </section>
  );
}
