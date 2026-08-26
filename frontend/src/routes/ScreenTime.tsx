import { useEffect, useState } from "react";

import { getScreenTime } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import { IconMonitor } from "../components/icons";
import KpiCard, { type KpiTone } from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { ScreenTimeResponse } from "../types/liveDashboard";

const TIER_TONE: Record<string, KpiTone> = {
  High: "aqua",
  Partial: "amber",
  "No Data": "neutral",
};

export default function ScreenTime() {
  const [data, setData] = useState<ScreenTimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getScreenTime()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version]);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data) return <p className="loading-text">Loading…</p>;

  const { completion } = data;
  const distribution = data.total_screen_time_distribution.map((c) => ({ label: c.code, count: c.count }));

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Screen Time"
        subtitle="Digital Screen Exposure Questionnaire (DSEQ) — live REDCap instrument."
      />

      <div className="kpi-row">
        <KpiCard
          label="Instrument Completion"
          value={`${completion.completed} / ${completion.total_registered}`}
          sublabel={`${completion.percent}% of registered — ${completion.coverage_tier} coverage`}
          icon={IconMonitor}
          tone={TIER_TONE[completion.coverage_tier] ?? "neutral"}
        />
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

      <p className="chart-card-note" style={{ marginTop: "var(--space-2)" }}>
        {data.notes.scope}
      </p>
    </section>
  );
}
