import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import CoverageBar from "../components/CoverageBar";
import DataLoadError from "../components/DataLoadError";
import Funnel from "../components/Funnel";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StudyDataLoader from "../components/StudyDataLoader";
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
  if (!data || !overview) return <StudyDataLoader label="Loading assessment progress" />;

  return (
    <section>
      <PageHeader
        eyebrow="Study Progress"
        title="Assessment Progress"
        subtitle="How far registered children have progressed through the core assessment pipeline."
      />

      <ChartCard
        title="Instrument completion pipeline"
        subtitle="Each stage counts only children who also completed every prior stage — see Overview for the headline counts"
      >
        <Funnel stages={data.stages} />
      </ChartCard>

      <SectionHeader title="Instrument-level completion" note="Completion of each core instrument, individually" />
      <ChartCard title="Core REDCap Instruments Completed — by instrument" subtitle={`Out of ${overview.total_registered} registered children`}>
        <div className="coverage-list">
          {overview.instrument_coverage.map((c) => (
            <CoverageBar
              key={c.key}
              label={c.label}
              count={c.completed_count}
              total={overview.total_registered}
              percent={c.percent_of_registered}
              tier={c.coverage_tier}
            />
          ))}
        </div>
      </ChartCard>
    </section>
  );
}
