import { useEffect, useState } from "react";

import { getScreenTime } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { ScreenTimeResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

export default function ScreenTime() {
  const [data, setData] = useState<ScreenTimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getScreenTime()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading assessment data" subLabel="Connecting to live REDCap data…" />;

  const { completion } = data;
  const distribution = data.total_screen_time_distribution.map((c) => ({ label: c.code, count: c.count }));

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Screen Time"
        subtitle="Digital Screen Exposure Questionnaire (DSEQ) — live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge label={`${completion.coverage_tier} coverage`} tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"} />
        <span>
          {completion.completed} / {completion.total_registered} registered children completed this instrument (
          {completion.percent}%)
        </span>
      </div>

      <div className="kpi-row">
        {data.yes_no_items.map((item) => (
          <KpiCard key={item.code} label={item.code} value={item.count} sublabel={`of ${completion.total_registered} registered`} />
        ))}
      </div>

      <SectionHeader title="Average total daily screen time" note="DSEQ Q10, among children who completed the instrument" />
      <div className="chart-grid">
        <ChartCard title="Total daily screen time" subtitle="Self/parent-reported category">
          <CategoryBarChart data={distribution} mode="categorical" />
        </ChartCard>
      </div>
    </section>
  );
}
