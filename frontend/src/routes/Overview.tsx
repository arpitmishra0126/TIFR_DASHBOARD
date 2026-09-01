import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import CoverageBar from "../components/CoverageBar";
import Funnel from "../components/Funnel";
import { IconClipboardCheck, IconGraduationCap, IconUserCheck, IconUsers } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

// Subtle grouping for the Assessment Instrument Coverage panel — a group
// label is rendered above the first row whose key appears here. Order
// matches the backend's ALL_INSTRUMENTS order exactly, so no re-sorting
// is needed.
const COVERAGE_GROUP_STARTS: Record<string, string> = {
  registration: "Registration",
  ses: "Study Assessments",
  ssrs_parent: "Social Skills Assessments",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version, lastUpdated } = useRefresh();

  useEffect(() => {
    Promise.all([getOverview(), getProgress()])
      .then(([o, p]) => {
        setOverview(o);
        setProgress(p);
      })
      .catch((err: Error) => setError(err.message));
  }, [version]);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!overview || !progress) return <p className="loading-text">Loading live study data…</p>;

  const totalDataPoints = overview.all_instrument_coverage.reduce((sum, i) => sum + i.completed_count, 0);
  const partialCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "Partial");
  const noDataCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "No Data");
  const highCoverage = overview.all_instrument_coverage.filter((i) => i.coverage_tier === "High");

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
        Completed Assessment Set (temporary working label, pending official study terminology) = SES,
        DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS Parent all completed for the same
        child. See Assessment Instrument Coverage below for every instrument's own completion count,
        including SSRS Parent counted independently.
      </p>

      <ChartCard title="Assessment Instrument Coverage" subtitle="Individual instrument completion across registered children">
        <div className="coverage-list">
          {overview.all_instrument_coverage.map((instrument) => {
            const groupLabel = COVERAGE_GROUP_STARTS[instrument.key];
            return (
              <div key={instrument.key}>
                {groupLabel && <div className="coverage-group-label">{groupLabel}</div>}
                <CoverageBar
                  label={instrument.label}
                  count={instrument.completed_count}
                  total={overview.total_registered}
                  percent={instrument.percent_of_registered}
                  tier={instrument.coverage_tier}
                />
              </div>
            );
          })}
        </div>
      </ChartCard>

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
