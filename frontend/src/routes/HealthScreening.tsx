import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import { IconHeart } from "../components/icons";
import HorizontalBarChart from "../components/HorizontalBarChart";
import KpiCard, { type KpiTone } from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { HealthScreeningResponse } from "../types/liveDashboard";

const TIER_TONE: Record<string, KpiTone> = {
  High: "aqua",
  Partial: "amber",
  "No Data": "neutral",
};

export default function HealthScreening() {
  const [data, setData] = useState<HealthScreeningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getHealthScreening()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version]);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data) return <p className="loading-text">Loading…</p>;

  const { completion } = data;
  const namedConditions = data.named_conditions.map((c) => ({ label: c.code, count: c.count }));
  const generalFlags = data.general_flags.map((c) => ({ label: c.code, count: c.count }));

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Health & Screening"
        subtitle="Child Illness History — live REDCap instrument."
      />

      <div className="kpi-row">
        <KpiCard
          label="Instrument Completion"
          value={`${completion.completed} / ${completion.total_registered}`}
          sublabel={`${completion.percent}% of registered — ${completion.coverage_tier} coverage`}
          icon={IconHeart}
          tone={TIER_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader
        title="Named conditions"
        note={`Children answering "Yes" — n=${completion.completed}/${completion.total_registered} completed the instrument`}
      />
      <div className="chart-grid">
        <ChartCard title="Named conditions (Yes counts)" subtitle="Child Illness History, item 8">
          <HorizontalBarChart data={namedConditions} />
        </ChartCard>
        <ChartCard title="General health flags (Yes counts)" subtitle="Illness, chronic condition, hospitalisation, etc.">
          <HorizontalBarChart data={generalFlags} />
        </ChartCard>
      </div>

      <p className="chart-card-note" style={{ marginTop: "var(--space-2)" }}>
        {data.notes.scope}
      </p>
    </section>
  );
}
