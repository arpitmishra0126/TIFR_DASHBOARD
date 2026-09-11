import { useEffect, useState } from "react";

import { getPhysicalActivity } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import ConditionCompositionChart from "../components/charts/ConditionCompositionChart";
import ItemScoreBarChart from "../components/charts/ItemScoreBarChart";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type { PhysicalActivityResponse, ScoreSummary, ScoredItemSummary, WeeklyActivityDay } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function scoreValue(summary: ScoreSummary): string {
  return summary.mean !== null ? summary.mean.toFixed(2) : "-";
}

// Final PAQ-C Score = mean of Items 1-9 (`paq_total_score`, REDCap's own
// calc field) - already excludes Item 10. Item 9 Score / Daily Activity
// Score both read the mean of the Monday-Sunday daily ratings
// (`paq_item8_score`) - the approved scoring specification names this one
// value two ways (by item number and by its everyday name), so both cards
// intentionally show the same figure rather than a second calculation.
const PAQC_SCORE_RANGE = "Range 1–5";

function keyScoreSublabel(summary: ScoreSummary): string {
  if (summary.valid_n === 0) return `${PAQC_SCORE_RANGE} · no data (0/${summary.total})`;
  return `${PAQC_SCORE_RANGE} · n=${summary.valid_n}/${summary.total} (${summary.percent_valid}%)`;
}

function itemScoresToChart(items: ScoredItemSummary[]) {
  return items.map((item) => ({
    label: item.label.replace(/^Item \d+(\/\d+)? - /, ""),
    mean: item.mean,
    validN: item.valid_n,
    total: item.total,
  }));
}

function weeklyActivityToChart(days: WeeklyActivityDay[]) {
  return days.map((day) => ({
    label: day.day,
    mean: day.mean,
    validN: day.valid_n,
    total: day.total,
  }));
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
  if (!data) return <FullScreenLoader message="Loading Physical Activity..." />;

  const { completion } = data;
  const distribution = data.total_score_distribution.map((c) => ({ label: c.code, count: c.count }));

  return (
    <section className="physical-activity-page">
      <PageHeader eyebrow="Study Assessment" title="Physical Activity (PAQ-C)" subtitle="PAQ-C physical activity assessment - live REDCap instrument." />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader title="PAQ-C Key Scores" note="Final PAQ-C Score = mean of Items 1–9 · Item 10 is excluded" />
      <div className="kpi-row">
        <KpiCard
          label="Final PAQ-C Score"
          value={scoreValue(data.total_summary)}
          sublabel={keyScoreSublabel(data.total_summary)}
          tone="violet"
        />
        <KpiCard label="Item 9 Score" value={scoreValue(data.item8_summary)} sublabel={keyScoreSublabel(data.item8_summary)} tone="blue" />
        <KpiCard
          label="Daily Activity Score"
          value={scoreValue(data.item8_summary)}
          sublabel={keyScoreSublabel(data.item8_summary)}
          tone="aqua"
        />
      </div>

      <SectionHeader title="Final PAQ-C Score Distribution" note="Mean of Items 1–9 · possible range 1–5" />
      <div className="chart-grid">
        <ChartCard
          title="Final PAQ-C Score"
          subtitle={`n=${data.total_summary.valid_n}/${data.total_summary.total} (${data.total_summary.percent_valid}%)`}
          compact
        >
          <CategoryBarChart data={distribution} mode="categorical" height={200} />
        </ChartCard>
      </div>

      <SectionHeader title="Items 1–8" note="Retained score per item, 1–5 scale" />
      <div className="chart-grid">
        <ChartCard title="Item Scores" subtitle={`Mean score per item · ${completion.completed} children completed the instrument`} compact>
          <ItemScoreBarChart data={itemScoresToChart(data.item_scores)} color="var(--series-1)" />
        </ChartCard>
      </div>

      <SectionHeader title="Item 9 — Monday–Sunday Activity" note="Mean daily activity rating, 1–5 scale (None=1 … Very often=5)" />
      <div className="chart-grid">
        <ChartCard title="Daily Activity by Day" subtitle="Mean rating per weekday" compact>
          <ItemScoreBarChart data={weeklyActivityToChart(data.weekly_activity)} color="var(--series-3)" labelWidth={110} />
        </ChartCard>
      </div>

      <SectionHeader title="Item 10" note="Shown separately · excluded from the Final PAQ-C Score" />
      <ChartCard title="Item 10 Response" subtitle={`Among ${completion.completed} children who completed this instrument`} compact>
        <ConditionCompositionChart items={[data.item10_exclusion]} />
      </ChartCard>
    </section>
  );
}
