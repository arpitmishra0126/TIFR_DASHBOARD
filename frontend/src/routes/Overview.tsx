import { useEffect, useState } from "react";

import { getOverview, getProgress } from "../api/dashboard";
import { IconClipboardCheck, IconGraduationCap, IconHeart, IconUserCheck, IconUsers } from "../components/icons";
import KpiCard, { type KpiTone } from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import ProgressStageCard from "../components/ProgressStageCard";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { OverviewResponse, ProgressResponse } from "../types/liveDashboard";

const STAGE_VISUALS: Record<string, { icon: typeof IconUsers; tone: KpiTone }> = {
  registered: { icon: IconUsers, tone: "blue" },
  core_assessment_battery: { icon: IconClipboardCheck, tone: "aqua" },
  ssrs_child: { icon: IconUserCheck, tone: "violet" },
  ssrs_teacher: { icon: IconGraduationCap, tone: "amber" },
};

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version } = useRefresh();

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

  const showRegistrationCompletion = overview.registration_complete_percent < 100;

  return (
    <section>
      <PageHeader
        eyebrow="ICMR Neurodevelopment Study"
        title="Study Population & Assessment Dashboard"
        subtitle="Live snapshot of study registration and assessment progress."
      />

      <div className="kpi-row">
        <KpiCard label="Registered" value={overview.total_registered.toLocaleString()} icon={IconUsers} tone="blue" />
        {showRegistrationCompletion && (
          <KpiCard
            label="Registration Complete"
            value={overview.registration_complete_count.toLocaleString()}
            sublabel={`${overview.registration_complete_percent}% of registered`}
            icon={IconUsers}
            tone="blue"
          />
        )}
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
        Completed Assessment Set (temporary working label, pending official study terminology) = SES,
        DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS Parent all completed for the same
        child. SSRS Parent above is counted independently and is not limited to that set.
      </p>

      <SectionHeader
        title="Assessment progress"
        note="Each stage counts only children who also completed every prior stage — see Assessment Progress for instrument-level detail"
      />
      <div className="stage-grid">
        {progress.stages.map((stage) => {
          const visual = STAGE_VISUALS[stage.key] ?? { icon: IconUsers, tone: "neutral" as KpiTone };
          return <ProgressStageCard key={stage.key} stage={stage} icon={visual.icon} tone={visual.tone} />;
        })}
      </div>
    </section>
  );
}
