import type { ProgressStage } from "../types/liveDashboard";

interface FunnelProps {
  stages: ProgressStage[];
}

export default function Funnel({ stages }: FunnelProps) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="funnel">
      {stages.map((stage) => {
        const pct = (stage.count / maxCount) * 100;
        return (
          <div key={stage.key} className="funnel-step">
            <div>
              <div className="funnel-step-name">{stage.label}</div>
              {stage.description && <div className="funnel-step-note">{stage.description}</div>}
            </div>
            <div className="funnel-track">
              <div className="funnel-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="funnel-step-value">
              <div>{stage.count.toLocaleString()}</div>
              <div className="funnel-step-percent">
                {stage.percent_of_previous_stage === null
                  ? `${stage.percent_of_registered}% of registered`
                  : `${stage.percent_of_previous_stage}% of previous stage`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
