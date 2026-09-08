import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getOverview } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import { percentOf } from "../components/charts/chartHelpers";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DonutChart from "../components/DonutChart";
import HorizontalBarChart from "../components/HorizontalBarChart";
import { IconClipboardCheck, IconMonitor, IconUserCheck, IconUsers } from "../components/icons";
import InstrumentCoverageCard from "../components/InstrumentCoverageCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import SnapshotMetricCard, { SnapshotCardShell } from "../components/SnapshotMetricCard";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { ConditionIndicator, OverviewResponse } from "../types/liveDashboard";
import { GROUPS } from "./AssessmentsHub";

// The 8 currently-mapped assessment instruments (excludes Registration/
// Baseline, which is already the "Registered" Snapshot KPI) - reuses the
// same instrument metadata (name/purpose/route/icon) as the Assessments hub
// so the two pages can never drift apart on what an instrument is called.
const OVERVIEW_INSTRUMENTS = GROUPS.flatMap((g) => g.available).filter((i) => i.key !== "registration");

interface SsrsRow {
  label: string;
  count: number;
  total: number;
  percent: number;
}

/** Single "SSRS" headline card holding the Parent/Child/Teacher breakdown
 * as compact label/value lines - deliberately one top-level card, not
 * three, per the 2026-09-08 Overview correction. Coverage-only (n/N/%),
 * no bars - the full SSRS item-level analysis stays on the
 * Neurodevelopment assessment page. */
function SsrsSummaryCard({ rows }: { rows: SsrsRow[] }) {
  return (
    <SnapshotCardShell label="SSRS" icon={IconUserCheck} tone="violet">
      <div className="snapshot-ssrs-list">
        {rows.map((row) => (
          <div className="snapshot-ssrs-row" key={row.label}>
            <span className="snapshot-ssrs-row-label">{row.label}</span>
            {row.count > 0 ? (
              <span className="snapshot-ssrs-row-value">
                {row.count}/{row.total} ({row.percent}%)
              </span>
            ) : (
              <span className="snapshot-ssrs-row-value snapshot-ssrs-row-muted">No data available</span>
            )}
          </div>
        ))}
      </div>
    </SnapshotCardShell>
  );
}

/** Highest-prevalence reported conditions/indicators, for a compact
 * Overview-level health signal - NOT the full item-level breakdown (that
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
  const { version } = useRefresh();

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

  const topHealthSignals = topReportedItems(overview.chh_named_conditions, overview.chh_general_flags, 1);

  const dseqAnswered = overview.dseq_screen_time_distribution.reduce((sum, c) => sum + c.count, 0);
  const dseqDominant = [...overview.dseq_screen_time_distribution].sort((a, b) => b.count - a.count)[0];

  return (
    <section className="overview-page">
      <PageHeader
        eyebrow="ICMR Neurodevelopment Study"
        title="Study Population & Assessment Dashboard"
        subtitle="Live snapshot of study registration and assessment progress."
      />

      <SectionHeader title="Study snapshot" note="Headline counts, each independently live-calculated from REDCap" />
      <div className="snapshot-strip">
        <SnapshotMetricCard
          label="Registered"
          value={overview.total_registered.toLocaleString()}
          support="Total study population"
          icon={IconUsers}
          tone="blue"
        />
        <SnapshotMetricCard
          label="Core REDCap Instruments Completed"
          value={overview.core_assessment_count.toLocaleString()}
          support={`${overview.core_assessment_count}/${overview.total_registered} (${overview.core_assessment_percent}%)`}
          icon={IconClipboardCheck}
          tone="aqua"
        />
        <SnapshotMetricCard
          label="DSEQ / Screen Time"
          value={overview.dseq_completion.completed.toLocaleString()}
          support={`${overview.dseq_completion.completed}/${overview.dseq_completion.total_registered} (${overview.dseq_completion.percent}%)`}
          icon={IconMonitor}
          tone="amber"
        />
        <SsrsSummaryCard
          rows={[
            { label: "Parent", count: overview.ssrs_parent_count, total: overview.total_registered, percent: overview.ssrs_parent_percent },
            { label: "Child", count: overview.ssrs_child_count, total: overview.total_registered, percent: overview.ssrs_child_percent },
            { label: "Teacher", count: overview.ssrs_teacher_count, total: overview.total_registered, percent: overview.ssrs_teacher_percent },
          ]}
        />
      </div>

      <SectionHeader title="Study profile" note="Who is registered in the study" />
      <div className="chart-grid two-col">
        <ChartCard title="Sex Distribution" subtitle="Registered children, by sex">
          <DonutChart data={sexData} height={190} centerValue={overview.total_registered} centerLabel="Registered" />
        </ChartCard>
        <ChartCard title="Age Distribution" subtitle="Registered children, by study age group">
          <CategoryBarChart data={ageData} mode="sequential" height={190} />
        </ChartCard>
      </div>
      <ChartCard title="SES Category (Udai Pareek)" subtitle="Registered children with an SES score">
        <HorizontalBarChart data={udaiData} mode="sequential" />
      </ChartCard>

      <SectionHeader
        title="Assessment coverage"
        note="Each of the 8 currently-mapped study instruments, independently calculated - tap a card for its full analysis"
      />
      <div className="instrument-grid">
        {OVERVIEW_INSTRUMENTS.map((instrument) => (
          <InstrumentCoverageCard key={instrument.key} instrument={instrument} overview={overview} />
        ))}
      </div>

      <SectionHeader title="Current data signals" note="What we're seeing - one high-level indicator per instrument; full item-level analysis lives on each assessment page" />
      <div className="chart-grid two-col">
        <ChartCard
          title="Most commonly reported condition or indicator"
          subtitle={`Child Illness History · ${overview.chh_completion.completed}/${overview.chh_completion.total_registered} completed (${overview.chh_completion.percent}%)`}
        >
          {topHealthSignals.length === 0 ? (
            <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
              No conditions or indicators have been reported "Yes" yet among completed records.
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

        <ChartCard
          title="Dominant total daily screen time"
          subtitle={`DSEQ · ${overview.dseq_completion.completed}/${overview.dseq_completion.total_registered} completed (${overview.dseq_completion.percent}%)`}
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
      </div>

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
