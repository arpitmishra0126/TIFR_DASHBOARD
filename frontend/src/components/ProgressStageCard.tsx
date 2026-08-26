import type { ComponentType, SVGProps } from "react";

import { IconCheckCircle, IconDotFilled, IconRing } from "./icons";
import type { KpiTone } from "./KpiCard";
import type { ProgressStage } from "../types/liveDashboard";

type StageState = "baseline" | "active" | "pending";

function stageState(stage: ProgressStage): StageState {
  if (stage.percent_of_registered >= 100) return "baseline";
  if (stage.count > 0) return "active";
  return "pending";
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "baseline") return <IconCheckCircle width={14} height={14} />;
  if (state === "active") return <IconDotFilled width={14} height={14} />;
  return <IconRing width={14} height={14} />;
}

interface ProgressStageCardProps {
  stage: ProgressStage;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: KpiTone;
}

export default function ProgressStageCard({ stage, icon: Icon, tone }: ProgressStageCardProps) {
  const state = stageState(stage);
  const pct = Math.min(stage.percent_of_registered, 100);

  return (
    <div className={`stage-card kpi-tone-${tone} stage-card-${state}`}>
      <div className="stage-card-head">
        <span className="stage-card-icon">
          <Icon width={16} height={16} />
        </span>
        <span className="stage-card-name">{stage.label}</span>
        <span className="stage-card-state-icon" title={state}>
          <StageIcon state={state} />
        </span>
      </div>
      <div className="stage-card-metrics">
        <span className="stage-card-count">{stage.count.toLocaleString()}</span>
        <span className="stage-card-percent">{stage.percent_of_registered}% of registered</span>
      </div>
      <div className="stage-card-track">
        <div className="stage-card-fill" style={{ width: `${pct}%` }} />
      </div>
      {stage.description && <p className="stage-card-desc">{stage.description}</p>}
    </div>
  );
}
