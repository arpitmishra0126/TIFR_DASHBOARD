import { useEffect, useState } from "react";

import { getScreenTime } from "../api/dashboard";
import BackToAssessments from "../components/BackToAssessments";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import ProportionBar from "../components/ProportionBar";
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
      <BackToAssessments />
      <PageHeader
        eyebrow="Study Assessment"
        title="Screen Time"
        subtitle="Digital Screen Exposure Questionnaire (DSEQ) — live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader
        title="Distribution of Total Daily Screen Time"
        note="DSEQ Q10, ordered low to high, among children who completed the instrument"
      />
      <div className="chart-grid">
        <ChartCard title="Distribution of Total Daily Screen Time" subtitle="Self/parent-reported category">
          <CategoryBarChart data={distribution} mode="categorical" />
        </ChartCard>
      </div>

      <SectionHeader title="Key behavioural indicators" note={`Yes responses, of ${completion.total_registered} registered children`} />
      <ChartCard title="Screen-use behaviour" subtitle="DSEQ Q9 / Q14 / Q15">
        <div className="response-list">
          {data.yes_no_items.map((item) => (
            <div className="response-item" key={item.code}>
              <div className="response-item-header">
                <span className="response-item-label">{item.code}</span>
                <span className="response-item-value">
                  {item.count} / {completion.total_registered}
                </span>
              </div>
              <ProportionBar value={item.count} total={completion.total_registered} />
            </div>
          ))}
        </div>
      </ChartCard>
    </section>
  );
}
