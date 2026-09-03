import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getOverview } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import { percentOf } from "../components/charts/chartHelpers";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DonutChart from "../components/DonutChart";
import HorizontalBarChart from "../components/HorizontalBarChart";
import { IconClipboardCheck, IconGraduationCap, IconHeart, IconUserCheck, IconUsers } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { ConditionIndicator, OverviewResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

/** Highest-prevalence reported conditions/indicators, for a compact
 * Overview-level health signal — NOT the full item-level breakdown (that
 * stays exclusively on the Child Illness History assessment page). */
function topReportedItems(named: ConditionIndicator[], general: ConditionIndicator[], limit = 5): ConditionIndicator[] {
  return [...named, ...general]
    .filter((i) => i.yes_count > 0)
    .sort((a, b) => b.yes_count - a.yes_count || b.percent_yes - a.percent_yes)
    .slice(0, limit);
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version, lastUpdated } = useRefresh();

  useEffect(() => {
    setError(null);
    getOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview) return <StudyDataLoader />;

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
    label: c.code,
    count: c.count,
  }));

  const topHealthSignals = topReportedItems(overview.chh_named_conditions, overview.chh_general_flags);

  const dseqAnswered = overview.dseq_screen_time_distribution.reduce((sum, c) => sum + c.count, 0);
  const dseqDominant = [...overview.dseq_screen_time_distribution].sort((a, b) => b.count - a.count)[0];

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
          label="Core REDCap Instruments Completed"
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
        Core REDCap Instruments Completed = SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake and
        SSRS Parent all completed for the same child.
      </p>

      <SectionHeader title="Study profile" note="Who is registered in the study" />
      <div className="chart-grid two-col">
        <ChartCard title="Sex Distribution" subtitle="Registered children, by sex">
          <DonutChart data={sexData} height={168} centerValue={overview.total_registered} centerLabel="Registered" />
        </ChartCard>
        <ChartCard title="Age Distribution" subtitle="Registered children, by study age group">
          <CategoryBarChart data={ageData} mode="sequential" height={190} />
        </ChartCard>
      </div>
      <ChartCard title="SES Category (Udai Pareek)" subtitle="Registered children with an SES score">
        <HorizontalBarChart data={udaiData} mode="sequential" />
      </ChartCard>

      <SectionHeader title="Assessment coverage" note="Completion of each of the 9 live instruments, independently calculated" />
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Assessment Instrument</th>
              <th>Completed</th>
              <th style={{ minWidth: 160 }}>Coverage</th>
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
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ flex: "0 0 60px" }}>{instrument.percent_of_registered}%</span>
                    <span style={{ flex: 1, minWidth: 60 }}>
                      <ProportionBar
                        value={instrument.completed_count}
                        total={overview.total_registered}
                        color={
                          instrument.coverage_tier === "High"
                            ? "var(--status-good)"
                            : instrument.coverage_tier === "Partial"
                              ? "var(--status-warning)"
                              : "var(--baseline)"
                        }
                      />
                    </span>
                  </div>
                </td>
                <td>
                  <StatusBadge label={instrument.coverage_tier} tone={TIER_BADGE_TONE[instrument.coverage_tier] ?? "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Broad health signal" note="Child Illness History — high-level summary; full item-by-item analysis lives on its own page" />
      <ChartCard
        title="Most commonly reported conditions & indicators"
        subtitle={`Among ${overview.chh_completion.completed} of ${overview.chh_completion.total_registered} registered children who completed Child Illness History (${overview.chh_completion.percent}%)`}
      >
        {topHealthSignals.length === 0 ? (
          <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
            No conditions or indicators have been reported "Yes" yet among completed Child Illness History records.
          </p>
        ) : (
          <div className="response-list">
            {topHealthSignals.map((item) => (
              <div className="response-item" key={item.label}>
                <div className="response-item-header">
                  <span className="response-item-label">{item.label}</span>
                  <span className="response-item-value">
                    {item.yes_count} ({item.percent_yes}%)
                  </span>
                </div>
                <ProportionBar value={item.yes_count} total={item.valid_n} color="var(--series-1)" />
              </div>
            ))}
          </div>
        )}
        <Link to="/health-screening" className="chart-card-link">
          View full Child Illness History analysis →
        </Link>
      </ChartCard>

      <SectionHeader title="Broad screen-time signal" note="DSEQ — high-level summary; full detailed analysis lives on its own page" />
      <ChartCard
        title="Total daily screen time — dominant pattern"
        subtitle={`Among ${overview.dseq_completion.completed} of ${overview.dseq_completion.total_registered} registered children who completed DSEQ (${overview.dseq_completion.percent}%)`}
      >
        {dseqAnswered === 0 || !dseqDominant ? (
          <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
            No DSEQ Q10 responses have been recorded yet.
          </p>
        ) : (
          <div className="response-item">
            <div className="response-item-header">
              <span className="response-item-label">Most reported: {dseqDominant.code}</span>
              <span className="response-item-value">
                {dseqDominant.count} / {dseqAnswered} ({percentOf(dseqDominant.count, dseqAnswered)}%)
              </span>
            </div>
            <ProportionBar value={dseqDominant.count} total={dseqAnswered} color="var(--series-1)" />
          </div>
        )}
        <Link to="/screen-time" className="chart-card-link">
          View full Screen Time (DSEQ) analysis →
        </Link>
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
