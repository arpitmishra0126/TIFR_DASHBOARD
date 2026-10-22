import type { ComponentType, ReactNode, SVGProps } from "react";

import ProportionBar from "./ProportionBar";

export type KpiTone = "blue" | "violet" | "aqua" | "amber" | "neutral";

interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: KpiTone;
  trailing?: ReactNode;
  /** Optional thin proportion bar rendered directly beneath the value,
   * above the sublabel row - opt-in, every existing caller that omits it
   * renders exactly as before. */
  progress?: { value: number; total: number; color?: string };
}

export default function KpiCard({ label, value, sublabel, icon: Icon, tone = "neutral", trailing, progress }: KpiCardProps) {
  return (
    <div className={`kpi-card kpi-tone-${tone}`}>
      <div className="kpi-card-top">
        <div className="kpi-label">{label}</div>
        {Icon && (
          <div className="kpi-icon">
            <Icon width={16} height={16} />
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {progress && (
        <ProportionBar value={progress.value} total={progress.total} color={progress.color ?? "var(--tone-accent, var(--series-1))"} />
      )}
      {(sublabel || trailing) && (
        <div className="kpi-sublabel-row">
          {sublabel && <div className="kpi-sublabel">{sublabel}</div>}
          {trailing}
        </div>
      )}
    </div>
  );
}
