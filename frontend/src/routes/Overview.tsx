import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DonutChart from "../components/DonutChart";
import Funnel from "../components/Funnel";
import HorizontalBarChart from "../components/HorizontalBarChart";
import { IconClipboardCheck, IconGraduationCap, IconHeart, IconUserCheck, IconUsers } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version, lastUpdated } = useRefresh();

  useEffect(() => {
    setError(null);
    Promise.all([getOverview(), getProgress()])
      .then(([o, p]) => {
        setOverview(o);
        setProgress(p);
      })
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview || !progress) return <StudyDataLoader />;

  const partialCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "Partial");
  const noDataCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "No Data");
  const highCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "High");
  const totalDataPoints = overview.all_instrument_coverage.reduce((sum, i) => sum + i.completed_count, 0);

  const sexData = [
    { label: "Male", count: overview.sex_distribution.male },
    { label: "Female", count: overview.sex_distribution.female },
    { label: "Unknown", count: overview.sex_distribution.unknown },
  ].filter((d) => d.count > 0);

  const ageData = overview.age_distribution.map((b) => ({ label: b.label, count: b.count }));

  const udaiData = overview.udai_pareek_category_distribution.map((c) => ({
    label: `Category ${c.code}`,
    count: c.count,
  }));

  return (
    <section>
      <PageHeader
        eyebrow="ICMR Neurodevelopment Study"
        title="Study Population & Assessment Dashboard"
        subtitle="Live snapshot of study registration and assessment progress."
      />

      <SectionHeader title="Study snapshot" note="Headline counts, each independently live-calculated from REDCap" />
      <div className="kpi-row">
        <KpiCard label="Registered" value={overview.total_registered.toLocaleString()} icon={IconUsers} tone="blue" />
        <KpiCard
          label="Completed Assessment Set"
          value={overview.core_assessment_count.toLocaleString()}
          sublabel={`${overview.core_assessment_percent}% of registered`}
          icon={IconClipboardCheck}
          tone="aqua"
        />
        <KpiCard
          label="SSRS Parent"
          value={overview.ssrs_parent_count.toLocaleString()}
          sublabel={`${overview.ssrs_parent_percent}% of registered`}
          icon={IconHeart}
          tone="neutral"
        />
        <KpiCard
          label="SSRS Child"
          value={overview.ssrs_child_count.toLocaleString()}
          sublabel={`${overview.ssrs_child_percent}% of registered`}
          icon={IconUserCheck}
          tone="violet"
        />
        <KpiCard
          label="SSRS Teacher"
          value={overview.ssrs_teacher_count.toLocaleString()}
          sublabel={`${overview.ssrs_teacher_percent}% of registered`}
          icon={IconGraduationCap}
          tone="amber"
        />
      </div>
      <p className="chart-card-note" style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-5)", borderTop: "none", paddingTop: 0 }}>
        Completed Assessment Set = SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS
        Parent all completed for the same child.
      </p>

      <SectionHeader title="Study profile" note="Who is registered in the study" />
      <div className="chart-grid three-col">
        <ChartCard title="Sex Distribution">
          <DonutChart data={sexData} />
        </ChartCard>
        <ChartCard title="Age Distribution">
          <CategoryBarChart data={ageData} mode="sequential" />
        </ChartCard>
        <ChartCard title="SES Category (Udai Pareek)">
          <HorizontalBarChart data={udaiData} />
        </ChartCard>
      </div>

      <SectionHeader title="Assessment coverage" note="Completion of each of the 9 live instruments, independently calculated" />
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Assessment Instrument</th>
              <th>Completed</th>
              <th>Coverage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {overview.all_instrument_coverage.map((instrument) => (
              <tr key={instrument.key}>
                <td>{instrument.label}</td>
                <td>
                  {instrument.completed_count} / {overview.total_registered}
                </td>
                <td>{instrument.percent_of_registered}%</td>
                <td>
                  <StatusBadge label={instrument.coverage_tier} tone={TIER_BADGE_TONE[instrument.coverage_tier] ?? "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ChartCard
        title="Study Progress"
        subtitle="Each stage counts only children who also completed every prior stage"
      >
        <Funnel stages={progress.stages} />
      </ChartCard>

      <ChartCard title="Data Collection & Quality Status" subtitle="Where collection currently stands, and where it is lagging">
        <div className="status-stat-grid">
          <div className="status-stat">
            <div className="status-stat-value">{totalDataPoints.toLocaleString()}</div>
            <div className="status-stat-label">Instrument completions collected (across all 9 instruments)</div>
          </div>
          <div className="status-stat">
            <div className="status-stat-value">
              {highCoverage.length} / {overview.all_instrument_coverage.length}
            </div>
            <div className="status-stat-label">Instruments at High coverage (≥50% of registered)</div>
          </div>
          <div className="status-stat">
            <div className="status-stat-value">
              {partialCoverage.length + noDataCoverage.length} / {overview.all_instrument_coverage.length}
            </div>
            <div className="status-stat-label">Instruments needing attention (Partial or No Data)</div>
          </div>
          <div className="status-stat">
            <div className="status-stat-value">{lastUpdated ? formatTime(lastUpdated) : "—"}</div>
            <div className="status-stat-label">Last refresh</div>
          </div>
        </div>

        {(partialCoverage.length > 0 || noDataCoverage.length > 0) && (
          <div className="status-flag-list">
            {partialCoverage.length > 0 && (
              <p className="status-flag-row">
                <span className="status-flag-tag status-flag-tag-warning">Partial coverage</span>
                {partialCoverage.map((i) => i.label).join(", ")}
              </p>
            )}
            {noDataCoverage.length > 0 && (
              <p className="status-flag-row">
                <span className="status-flag-tag status-flag-tag-neutral">No completed assessments yet</span>
                {noDataCoverage.map((i) => i.label).join(", ")}
              </p>
            )}
          </div>
        )}
      </ChartCard>
    </section>
  );
}
