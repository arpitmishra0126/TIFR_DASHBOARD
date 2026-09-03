import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import BackToAssessments from "../components/BackToAssessments";
import ChartCard from "../components/ChartCard";
import ConditionCompositionChart from "../components/charts/ConditionCompositionChart";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
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

function CompositionLegend() {
  return (
    <div className="composition-legend">
      <span className="composition-legend-item">
        <span className="composition-legend-swatch" style={{ background: "var(--series-1)" }} />
        Yes
      </span>
      <span className="composition-legend-item">
        <span className="composition-legend-swatch" style={{ background: "var(--baseline)" }} />
        No
      </span>
      <span className="composition-legend-item">
        <span className="composition-legend-swatch" style={{ background: "var(--series-4)" }} />
        Don't know
      </span>
      <span>— each bar is 100% of that item's own valid respondents</span>
    </div>
  );
}

function DetailTable({ rows }: { rows: ConditionIndicator[] }) {
  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Yes</th>
            <th>No</th>
            <th>Don't know</th>
            <th>Valid N</th>
            <th>Asked N</th>
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
              <td>{c.asked_n}</td>
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
      <BackToAssessments />
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
        title="Reported Health Conditions, n (%)"
        note="Percentages use each condition's own valid respondents, not the full registered cohort"
      />
      <ChartCard title="Reported Health Conditions" subtitle={`Among ${completion.completed} children who completed this instrument`}>
        <CompositionLegend />
        <ConditionCompositionChart items={data.named_conditions} />
      </ChartCard>
      <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
        <DetailTable rows={data.named_conditions} />
      </DetailDisclosure>

      <SectionHeader
        title="Reported Health and Medical-History Indicators, n (%)"
        note="Percentages use each indicator's own valid respondents, not the full registered cohort"
      />
      <ChartCard
        title="Reported Health and Medical-History Indicators"
        subtitle={`Among ${completion.completed} children who completed this instrument`}
      >
        <CompositionLegend />
        <ConditionCompositionChart items={data.general_flags} />
      </ChartCard>
      <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
        <DetailTable rows={data.general_flags} />
      </DetailDisclosure>
    </section>
  );
}
