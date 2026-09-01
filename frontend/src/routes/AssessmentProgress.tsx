import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import CoverageBar from "../components/CoverageBar";
import Funnel from "../components/Funnel";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

export default function AssessmentProgress() {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version } = useRefresh();

  useEffect(() => {
    Promise.all([getProgress(), getOverview()])
      .then(([p, o]) => {
        setData(p);
        setOverview(o);
      })
      .catch((err: Error) => setError(err.message));
  }, [version]);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data || !overview) return <p className="loading-text">Loading…</p>;

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
      <ChartCard title="Completed Assessment Set instruments" subtitle={`Out of ${overview.total_registered} registered children`}>
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
