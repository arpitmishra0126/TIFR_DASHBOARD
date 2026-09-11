import { useEffect, useState } from "react";

import { getDietaryIntake } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import HorizontalBarChart, { computeHorizontalBarChartHeight } from "../components/HorizontalBarChart";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type { DietaryIntakeResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

// Wide enough for the longest known REDCap frequency choice labels without
// truncating; shared by every food-group chart so their y-axis columns
// line up.
const FOOD_GROUP_LABEL_WIDTH = 190;

// Display-only English labels for the 10 die_*_freq fields' Hindi-only
// REDCap choices (confirmed live, e.g. die_grains_freq: "1, प्रतिदिन | 2,
// सप्ताह में 3-6 बार | ..." - see CLAUDE.md's "Known data characteristic"
// note) and the separate die_other_freq item, which shares the identical
// 8-level scale. This is a presentation mapping only, applied just before
// charting/table rendering - the REDCap choice codes, the resolved label
// text returned by the API, and every calculation/denominator/ordering
// upstream of this file are completely unchanged. A label with no match
// here (should never occur for these known 8 categories) renders as-is
// rather than disappearing.
const FREQUENCY_LABEL_EN: Record<string, string> = {
  "प्रतिदिन": "Daily",
  "सप्ताह में 3-6 बार": "3–6 times/week",
  "सप्ताह में 1-2 बार": "1–2 times/week",
  "15 दिनों में एक बार": "Once every 15 days",
  "मासिक": "Monthly",
  "6 महीने में एक बार": "Once every 6 months",
  "वार्षिक": "Annually",
  "शायद ही कभी/कभी नहीं": "Rarely/Never",
};

function toEnglishFrequencyLabel(label: string): string {
  return FREQUENCY_LABEL_EN[label] ?? label;
}

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
  if (!data) return <FullScreenLoader message="Loading Dietary Intake..." />;

  const { completion } = data;
  const otherFood = data.other_food_specified;
  const distributions = data.items.map((item) =>
    item.distribution.map((c) => ({ label: toEnglishFrequencyLabel(c.code), count: c.count })),
  );
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
                  <td>{entry.frequency_status === "recorded" && entry.frequency ? toEnglishFrequencyLabel(entry.frequency) : "Not answered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
