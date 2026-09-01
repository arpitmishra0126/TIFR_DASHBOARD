import StatusBadge from "./StatusBadge";
import type { CoverageTier } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<CoverageTier, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

interface CoverageBarProps {
  label: string;
  count: number;
  total: number;
  percent: number;
  tier?: CoverageTier;
}

export default function CoverageBar({ label, count, total, percent, tier }: CoverageBarProps) {
  return (
    <div className="coverage-row">
      <div className="coverage-label">{label}</div>
      <div className="coverage-track">
        <div className="coverage-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className="coverage-value">
        <span className="coverage-count">
          {count} / {total}
        </span>
        <span className="coverage-percent">{percent}%</span>
      </div>
      {tier && <StatusBadge label={tier} tone={TIER_BADGE_TONE[tier]} />}
    </div>
  );
}
