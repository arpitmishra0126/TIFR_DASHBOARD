import { IconCheckCircle, IconDotFilled, IconRing } from "./icons";
import type { ProgressStage } from "../types/liveDashboard";

interface FunnelProps {
  stages: ProgressStage[];
}

type StageState = "baseline" | "active" | "pending";

function stageState(stage: ProgressStage): StageState {
  if (stage.percent_of_registered >= 100) return "baseline";
  if (stage.count > 0) return "active";
  return "pending";
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "baseline") return <IconCheckCircle width={18} height={18} />;
  if (state === "active") return <IconDotFilled width={18} height={18} />;
  return <IconRing width={18} height={18} />;
}

export default function Funnel({ stages }: FunnelProps) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="funnel">
      {stages.map((stage) => {
        const pct = (stage.count / maxCount) * 100;
        const state = stageState(stage);
        return (
          <div key={stage.key} className={`funnel-step funnel-step-${state}`}>
            <div className="funnel-step-icon">
              <StageIcon state={state} />
            </div>
            <div className="funnel-step-info">
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
