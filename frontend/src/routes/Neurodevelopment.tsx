import { useEffect, useState } from "react";

import { getNeurodevelopment } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { ScoreSummary, SSRSInstrumentSummary } from "../types/liveDashboard";

function scoreValue(summary: ScoreSummary): string {
  return summary.mean !== null ? summary.mean.toFixed(2) : "—";
}

function scoreSublabel(summary: ScoreSummary): string {
  if (summary.valid_n === 0) return `No data acquired (0/${summary.total})`;
  return `${summary.valid_n} participants · ${summary.percent_valid}% coverage`;
}

function InstrumentSection({ summary }: { summary: SSRSInstrumentSummary }) {
  const hasData = summary.children_with_any_data > 0;

  return (
    <>
      <SectionHeader
        title={summary.instrument}
        note={`${summary.completed_count} fully complete · ${summary.children_with_any_data} of ${summary.total_registered} have at least one rating item answered`}
      />
      {!hasData ? (
        <ChartCard title={`${summary.instrument} — No data available`} subtitle="No completed responses yet for this instrument">
          <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
            0 of {summary.total_registered} registered children have any rating item answered. This will populate
            automatically once live {summary.instrument} data exists — no value is invented here.
          </p>
        </ChartCard>
      ) : (
        <>
          <ChartCard
            title="Coverage"
            subtitle={`${summary.children_with_any_data} of ${summary.total_registered} registered children have at least one rating item answered`}
          >
            <ProportionBar value={summary.children_with_any_data} total={summary.total_registered} />
          </ChartCard>
          <div className="kpi-row" style={{ marginBottom: "var(--space-5)" }}>
            <KpiCard label="Avg frequency rating" value={scoreValue(summary.avg_frequency_summary)} sublabel={scoreSublabel(summary.avg_frequency_summary)} />
            <KpiCard label="Avg importance rating" value={scoreValue(summary.avg_importance_summary)} sublabel={scoreSublabel(summary.avg_importance_summary)} />
          </div>
        </>
      )}
    </>
  );
}

export default function Neurodevelopment() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getNeurodevelopment>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getNeurodevelopment()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading assessment data" subLabel="Connecting to live REDCap data…" />;

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
    </section>
  );
}
