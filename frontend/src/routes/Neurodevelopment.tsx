import { useEffect, useState } from "react";

import { getNeurodevelopment } from "../api/dashboard";
import { IconBrain } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import type { ScoreSummary, SSRSInstrumentSummary } from "../types/liveDashboard";

function scoreValue(summary: ScoreSummary): string {
  return summary.mean !== null ? summary.mean.toFixed(2) : "—";
}

function scoreSublabel(summary: ScoreSummary): string {
  if (summary.valid_n === 0) return `No data acquired (0/${summary.total})`;
  return `n=${summary.valid_n}/${summary.total} acquired (${summary.percent_valid}%)`;
}

function InstrumentSection({ summary }: { summary: SSRSInstrumentSummary }) {
  return (
    <>
      <SectionHeader
        title={summary.instrument}
        note={`${summary.completed_count} fully complete · ${summary.children_with_any_data} of ${summary.total_registered} have at least one rating item answered`}
      />
      <div className="kpi-row" style={{ marginBottom: "var(--space-5)" }}>
        <KpiCard
          label="Children with any data"
          value={`${summary.children_with_any_data} / ${summary.total_registered}`}
          sublabel={`${summary.percent}% of registered`}
          icon={IconBrain}
          tone={summary.children_with_any_data > 0 ? "violet" : "neutral"}
        />
        <KpiCard label="Avg frequency rating" value={scoreValue(summary.avg_frequency_summary)} sublabel={scoreSublabel(summary.avg_frequency_summary)} />
        <KpiCard label="Avg importance rating" value={scoreValue(summary.avg_importance_summary)} sublabel={scoreSublabel(summary.avg_importance_summary)} />
      </div>
    </>
  );
}

export default function Neurodevelopment() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getNeurodevelopment>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getNeurodevelopment()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version]);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data) return <p className="loading-text">Loading…</p>;

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Neurodevelopment / Assessment"
        subtitle="Social Skills Rating System (SSRS) — Parent, Child and Teacher — live REDCap instruments."
      />

      <InstrumentSection summary={data.parent} />
      <InstrumentSection summary={data.child} />
      <InstrumentSection summary={data.teacher} />

      <p className="chart-card-note">{data.notes.scope}</p>
      <p className="chart-card-note">{data.notes.ssrs_teacher}</p>
    </section>
  );
}
