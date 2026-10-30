import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import { percentOf } from "../components/charts/chartHelpers";
import CoverageBar from "../components/CoverageBar";
import DataLoadError from "../components/DataLoadError";
import Funnel from "../components/Funnel";
import FullScreenLoader from "../components/FullScreenLoader";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

export default function AssessmentProgress() {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    Promise.all([getProgress(), getOverview()])
      .then(([p, o]) => {
        setData(p);
        setOverview(o);
      })
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data || !overview) return <FullScreenLoader message="Loading Assessment Progress..." />;

  // Denominated against the study's overall enrolled cohort (222,
  // STUDY_ORIGINAL_ENROLLMENT) rather than the backend's own
  // total_registered-based `percent_of_registered` - senior instruction,
  // same convention applied dashboard-wide. The "Registered" stage's own
  // count is also shown as 222 (it represents whole-cohort enrollment),
  // same precedent as the Dashboard's Study Progress pipeline; every other
  // stage's count is still the real, unmodified live achieved count, and
  // `percent_of_previous_stage` (stage-to-stage, not total_registered-
  // based) is untouched.
  const stages = data.stages.map((stage) => {
    const count = stage.key === "registered" ? STUDY_ORIGINAL_ENROLLMENT : stage.count;
    return { ...stage, count, percent_of_registered: percentOf(count, STUDY_ORIGINAL_ENROLLMENT) ?? 0 };
  });

  return (
    <section>
      <PageHeader
        eyebrow="Study Progress"
        title="Assessment Progress"
        subtitle="How far registered children have progressed through the core assessment pipeline."
      />

      <ChartCard
        title="Assessment status pipeline"
        subtitle="Cumulative - each stage requires every prior stage"
      >
        <Funnel stages={stages} />
      </ChartCard>

      <SectionHeader title="Assessment status by instrument" note="Completion of each core instrument, individually" />
      <ChartCard title="Core REDCap Instruments Completed - by instrument" subtitle={`Out of ${STUDY_ORIGINAL_ENROLLMENT} registered children`}>
        <div className="coverage-list">
          {overview.instrument_coverage.map((c) => (
            <CoverageBar
              key={c.key}
              label={c.label}
              count={c.completed_count}
              total={STUDY_ORIGINAL_ENROLLMENT}
              percent={percentOf(c.completed_count, STUDY_ORIGINAL_ENROLLMENT) ?? 0}
              tier={c.coverage_tier}
            />
          ))}
        </div>
      </ChartCard>
    </section>
  );
}
