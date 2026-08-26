import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import Funnel from "../components/Funnel";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

const MODULE_LABELS: Record<string, string> = {
  health_screening: "Health & Screening",
  physical_activity: "Physical Activity",
  screen_time: "Screen Time",
  neurodevelopment: "Neurodevelopment",
};

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getOverview(), getProgress()])
      .then(([o, p]) => {
        setOverview(o);
        setProgress(p);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!overview || !progress) return <p className="loading-text">Loading live study data…</p>;

  const showRegistrationCompletion = overview.registration_complete_percent < 100;

  return (
    <section>
      <PageHeader
        eyebrow="ICMR Neurodevelopment Study"
        title="Study Population & Assessment Dashboard"
        subtitle="Live snapshot of study registration and assessment progress."
      />

      <div className="kpi-row">
        <KpiCard label="Registered" value={overview.total_registered.toLocaleString()} />
        {showRegistrationCompletion && (
          <KpiCard
            label="Registration Complete"
            value={overview.registration_complete_count.toLocaleString()}
            sublabel={`${overview.registration_complete_percent}% of registered`}
          />
        )}
        <KpiCard
          label="Core Assessment Battery"
          value={overview.core_assessment_count.toLocaleString()}
          sublabel={`${overview.core_assessment_percent}% of registered`}
        />
        <KpiCard
          label="SSRS Child"
          value={overview.ssrs_child_count.toLocaleString()}
          sublabel={`${overview.ssrs_child_percent}% of registered`}
        />
        <KpiCard
          label="SSRS Teacher"
          value={overview.ssrs_teacher_count.toLocaleString()}
          sublabel={`${overview.ssrs_teacher_percent}% of registered`}
        />
      </div>
      <p className="chart-card-note" style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-5)" }}>
        Core Assessment Battery = SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS
        Parent all completed for the same child.
      </p>

      <SectionHeader
        title="Assessment progress"
        note="Each stage counts only children who also completed every prior stage — see Assessment Progress for instrument-level detail"
      />
      <ChartCard title="Instrument completion pipeline">
        <Funnel stages={progress.stages} />
      </ChartCard>

      <SectionHeader title="Module integration status" />
      <div className="chart-grid">
        <ChartCard
          title="Dashboard modules"
          subtitle="All 9 REDCap instruments exist; not all are field-mapped into this dashboard yet"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Participants, Demographics & SES, Assessment Progress</span>
              <StatusBadge label="Live" tone="good" />
            </div>
            {overview.modules_pending_integration.map((m) => (
              <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{MODULE_LABELS[m] ?? m}</span>
                <StatusBadge label="Instrument exists — not yet mapped" tone="neutral" />
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
