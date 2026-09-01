import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import HorizontalBarChart from "../components/HorizontalBarChart";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type { HealthScreeningResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
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

      <div className="module-status-line">
        <StatusBadge label={`${completion.coverage_tier} coverage`} tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"} />
        <span>
          {completion.completed} / {completion.total_registered} registered children completed this instrument (
          {completion.percent}%)
        </span>
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
