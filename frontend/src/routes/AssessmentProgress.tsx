import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import CoverageBar from "../components/CoverageBar";
import Funnel from "../components/Funnel";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

export default function AssessmentProgress() {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProgress(), getOverview()])
      .then(([p, o]) => {
        setData(p);
        setOverview(o);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data || !overview) return <p className="loading-text">Loading…</p>;

  return (
    <section>
      <PageHeader
        eyebrow="Study Progress"
        title="Assessment Progress"
        subtitle="How far registered children have progressed through the core assessment pipeline."
      />

      <div className="kpi-row" style={{ marginBottom: "var(--space-5)" }}>
        {data.stages.map((stage) => (
          <KpiCard
            key={stage.key}
            label={stage.label}
            value={stage.count.toLocaleString()}
            sublabel={`${stage.percent_of_registered}% of registered`}
          />
        ))}
      </div>

      <ChartCard
        title="Instrument completion pipeline"
        subtitle="Each stage counts only children who also completed every prior stage"
      >
        <Funnel stages={data.stages} />
      </ChartCard>

      <SectionHeader title="Instrument-level completion" note="Completion of each core instrument, individually" />
      <ChartCard title="Core battery instruments" subtitle={`Out of ${overview.total_registered} registered children`}>
        <div className="coverage-list">
          {overview.instrument_coverage.map((c) => (
            <CoverageBar
              key={c.key}
              label={c.label}
              count={c.completed_count}
              total={overview.total_registered}
              percent={c.percent_of_registered}
            />
          ))}
        </div>
      </ChartCard>
    </section>
  );
}
