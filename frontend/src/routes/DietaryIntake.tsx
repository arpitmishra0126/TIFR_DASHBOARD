import { useEffect, useState } from "react";

import { getDietaryIntake } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { DietaryIntakeResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

export default function DietaryIntake() {
  const [data, setData] = useState<DietaryIntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getDietaryIntake()
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
        title="Dietary Intake"
        subtitle="Food-group consumption frequency — live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader
        title="Consumption frequency by food group"
        note="Each food group's category order follows the REDCap frequency scale (Daily → ... → Rarely/Never); valid N shown per item"
      />
      <div className="chart-grid two-col">
        {data.items.map((item) => (
          <ChartCard
            key={item.field_label}
            title={item.field_label}
            subtitle={`n=${item.valid_n}/${completion.total_registered} answered (${item.percent_valid}%)`}
          >
            <CategoryBarChart data={item.distribution.map((c) => ({ label: c.code, count: c.count }))} mode="categorical" />
          </ChartCard>
        ))}
      </div>
    </section>
  );
}
