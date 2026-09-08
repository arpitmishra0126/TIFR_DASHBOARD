import type { ComponentType, ReactNode, SVGProps } from "react";

export type SnapshotTone = "blue" | "aqua" | "amber" | "violet";

interface SnapshotMetricCardProps {
  label: string;
  value: string | number;
  support?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SnapshotTone;
}

/** One column of Overview's Study Snapshot strip (the shared `KpiCard.tsx`
 * used elsewhere is untouched). Icon + normal-case title on one line, the
 * value directly beneath it, and one line of supporting n/N (%) text - no
 * pills, bars or per-item card chrome, since all four columns share one
 * outer frame (`.snapshot-strip` in `Overview.tsx`) rather than being four
 * separate boxes. */
export default function SnapshotMetricCard({ label, value, support, icon: Icon, tone }: SnapshotMetricCardProps) {
  return (
    <div className={`snapshot-strip-item snapshot-tone-${tone}`}>
      <div className="snapshot-card-head">
        <span className="snapshot-card-icon">
          <Icon width={15} height={15} />
        </span>
        <span className="snapshot-card-title">{label}</span>
      </div>
      <div className="snapshot-card-value">{value}</div>
      {support && <div className="snapshot-card-support">{support}</div>}
    </div>
  );
}

export function SnapshotCardShell({
  label,
  icon: Icon,
  tone,
  children,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SnapshotTone;
  children: ReactNode;
}) {
  return (
    <div className={`snapshot-strip-item snapshot-tone-${tone}`}>
      <div className="snapshot-card-head">
        <span className="snapshot-card-icon">
          <Icon width={15} height={15} />
        </span>
        <span className="snapshot-card-title">{label}</span>
      </div>
      {children}
    </div>
  );
}
