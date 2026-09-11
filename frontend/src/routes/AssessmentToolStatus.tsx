import { useEffect, useState } from "react";

import { getAssessmentToolStatus } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { AssessmentDomainStatus, AssessmentToolStatusResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function domainValue(domain: AssessmentDomainStatus): string {
  return domain.mean_done !== null ? `${domain.mean_done}/${domain.field_count}` : "-";
}

function domainSublabel(domain: AssessmentDomainStatus): string {
  if (domain.valid_n === 0) return `No data (0/${domain.total})`;
  return `${domain.completion_percent}% avg completion · n=${domain.valid_n}/${domain.total} (${domain.percent_valid}%)`;
}

export default function AssessmentToolStatus() {
  const [data, setData] = useState<AssessmentToolStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getAssessmentToolStatus()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading assessment data" subLabel="Connecting to live REDCap data…" />;

  const { completion } = data;

  return (
    <section className="assessment-tool-status-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Assessment Tool Status"
        subtitle="Administration status (Done / Not Done) for the SANGIAN and VWM-related tools - live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader title="Assessment Tool Status" note="Mean tools marked Done per child · not a validated outcome score" />
      <div className="kpi-row">
        <KpiCard label="SANGIAN Assessment Status" value={domainValue(data.sangian)} sublabel={domainSublabel(data.sangian)} tone="blue" />
        <KpiCard label="VWM & Related Tasks Status" value={domainValue(data.vwm)} sublabel={domainSublabel(data.vwm)} tone="violet" />
        <KpiCard label="Overall Assessment Tool Status" value={domainValue(data.overall)} sublabel={domainSublabel(data.overall)} tone="aqua" />
      </div>

      <SectionHeader
        title="Assessment Breakdown"
        note="Valid N = children who answered that specific assessment - blank responses are excluded, never counted as Not Done"
      />
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Done</th>
              <th>Not Done</th>
              <th>Valid N</th>
              <th>Completion %</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td className="assessment-tool-done-cell">{item.done_count}</td>
                <td className="assessment-tool-not-done-cell">{item.not_done_count}</td>
                <td>{item.valid_n}</td>
                <td>{item.completion_percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
