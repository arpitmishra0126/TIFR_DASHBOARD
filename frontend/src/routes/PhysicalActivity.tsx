import { useEffect, useState } from "react";

import { getPhysicalActivity } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
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
  return `${summary.valid_n} participants · ${summary.percent_valid}% coverage`;
}

export default function PhysicalActivity() {
  const [data, setData] = useState<PhysicalActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getPhysicalActivity()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading assessment data" subLabel="Connecting to live REDCap data…" />;

  const { completion } = data;
  const distribution = data.total_score_distribution.map((c) => ({ label: c.code, count: c.count }));

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Physical Activity (PAQ-A)"
        subtitle="Live REDCap instrument (recorded in REDCap as “PAQ A”)."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <div className="kpi-row">
        <KpiCard label="Item 1 composite score" value={scoreValue(data.item1_summary)} sublabel={scoreSublabel(data.item1_summary)} />
        <KpiCard label="Item 8 composite score" value={scoreValue(data.item8_summary)} sublabel={scoreSublabel(data.item8_summary)} />
        <KpiCard label="Total score" value={scoreValue(data.total_summary)} sublabel={scoreSublabel(data.total_summary)} tone="violet" />
      </div>
      <p className="chart-card-note" style={{ marginBottom: "var(--space-4)" }}>
        Instrument completion ({completion.completed}/{completion.total_registered}) and each score's valid N above
        are reported separately and are not forced to match — a completed instrument can still yield a blank
        calculated score if a dependent item was skipped.
      </p>

      <SectionHeader title="Total score distribution" note="REDCap-calculated field (paq_total_score)" />
      <div className="chart-grid">
        <ChartCard title="PAQ-A total score" subtitle="Mean of items 1-8 (excludes item 9)">
          <CategoryBarChart data={distribution} mode="sequential" />
        </ChartCard>
      </div>
    </section>
  );
}
