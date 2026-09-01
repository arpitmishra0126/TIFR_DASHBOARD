import { useEffect, useState } from "react";

import { getPhysicalActivity } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type { PhysicalActivityResponse, ScoreSummary } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function scoreValue(summary: ScoreSummary): string {
  return summary.mean !== null ? summary.mean.toFixed(2) : "—";
}

function scoreSublabel(summary: ScoreSummary): string {
  if (summary.valid_n === 0) return `No data acquired (0/${summary.total})`;
  return `n=${summary.valid_n}/${summary.total} acquired (${summary.percent_valid}%) · range ${summary.minimum}–${summary.maximum}`;
}

export default function PhysicalActivity() {
  const [data, setData] = useState<PhysicalActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getPhysicalActivity()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version]);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data) return <p className="loading-text">Loading…</p>;

  const { completion } = data;
  const distribution = data.total_score_distribution.map((c) => ({ label: c.code, count: c.count }));

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Physical Activity (PAQ-A)"
        subtitle="Physical Activity Questionnaire for Adolescents — live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge label={`${completion.coverage_tier} coverage`} tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"} />
        <span>
          {completion.completed} / {completion.total_registered} registered children completed this instrument (
          {completion.percent}%)
        </span>
      </div>

      <div className="kpi-row">
        <KpiCard label="Item 1 composite score" value={scoreValue(data.item1_summary)} sublabel={scoreSublabel(data.item1_summary)} />
        <KpiCard label="Item 8 composite score" value={scoreValue(data.item8_summary)} sublabel={scoreSublabel(data.item8_summary)} />
        <KpiCard label="Total score" value={scoreValue(data.total_summary)} sublabel={scoreSublabel(data.total_summary)} tone="violet" />
      </div>

      <SectionHeader title="Total score distribution" note="REDCap-calculated field (paq_total_score)" />
      <div className="chart-grid">
        <ChartCard title="PAQ-A total score" subtitle="Mean of items 1-8 (excludes item 9)">
          <CategoryBarChart data={distribution} mode="sequential" />
        </ChartCard>
      </div>

      <p className="chart-card-note" style={{ marginTop: "var(--space-2)" }}>
        {data.notes.scores}
      </p>
    </section>
  );
}
