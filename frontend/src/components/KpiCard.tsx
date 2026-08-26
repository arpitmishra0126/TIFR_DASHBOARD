import type { ComponentType, ReactNode, SVGProps } from "react";

export type KpiTone = "blue" | "violet" | "aqua" | "amber" | "neutral";

interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: KpiTone;
  trailing?: ReactNode;
}

export default function KpiCard({ label, value, sublabel, icon: Icon, tone = "neutral", trailing }: KpiCardProps) {
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
      {(sublabel || trailing) && (
        <div className="kpi-sublabel-row">
          {sublabel && <div className="kpi-sublabel">{sublabel}</div>}
          {trailing}
        </div>
      )}
    </div>
  );
}
