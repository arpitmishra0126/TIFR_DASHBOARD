import { useEffect, useState } from "react";

import { getDietaryIntake } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import HorizontalBarChart, { computeHorizontalBarChartHeight } from "../components/HorizontalBarChart";
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

// Wide enough for the longest known REDCap frequency choice labels
// (including the Hindi-only die_*_freq categories - see CLAUDE.md) without
// truncating; shared by every food-group chart so their y-axis columns
// line up.
const FOOD_GROUP_LABEL_WIDTH = 190;

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
  const otherFood = data.other_food_specified;
  const distributions = data.items.map((item) => item.distribution.map((c) => ({ label: c.code, count: c.count })));
  const sharedChartHeight = computeHorizontalBarChartHeight(distributions, FOOD_GROUP_LABEL_WIDTH, true);

  return (
    <section className="dietary-intake-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Dietary Intake"
        subtitle="Food-group consumption frequency - live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader title="Consumption frequency by food group" />
      <div className="chart-grid two-col">
        {data.items.map((item, index) => (
          <ChartCard
            key={item.field_label}
            title={item.field_label}
            subtitle={`n=${item.valid_n}/${completion.total_registered} answered (${item.percent_valid}%)`}
            compact
          >
            <HorizontalBarChart
              data={distributions[index]}
              mode="categorical"
              labelWidth={FOOD_GROUP_LABEL_WIDTH}
              height={sharedChartHeight}
              dense
            />
          </ChartCard>
        ))}
      </div>

      <SectionHeader
        title="Other Food Specified"
        note="Open-ended item (die_other_specify) - a separate entry from the 'Other Vegetables'/'Other Fruits' food groups above, not a duplicate of them"
      />
      <div className="table-card">
        <p className="chart-card-subtitle" style={{ padding: "var(--space-4) var(--space-4) 0" }}>
          {otherFood.valid_n}/{otherFood.total} registered children specified an additional food ({otherFood.percent_valid}%)
        </p>
        {otherFood.entries.length === 0 ? (
          <p className="chart-card-note" style={{ padding: "0 var(--space-4) var(--space-4)" }}>
            No children have specified an additional food item yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Food Name</th>
                <th>Portion Size</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {otherFood.entries.map((entry, index) => (
                <tr key={`${entry.food_name}-${index}`}>
                  <td>{entry.food_name}</td>
                  <td>{entry.portion_status === "recorded" ? entry.portion : entry.portion_status === "not_applicable" ? "Not applicable (rarely/never)" : "Not answered"}</td>
                  <td>{entry.frequency_status === "recorded" ? entry.frequency : "Not answered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
