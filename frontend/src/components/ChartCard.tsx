import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  note?: string;
  /** Denser padding, sharper corners, and tighter title/subtitle spacing -
   * opt-in so every existing caller keeps its current look; use for a
   * group of small, information-dense charts (e.g. Dietary Intake's 10
   * food-group charts). */
  compact?: boolean;
  children: ReactNode;
}

export default function ChartCard({ title, subtitle, note, compact, children }: ChartCardProps) {
  return (
    <div className={`chart-card${compact ? " chart-card-compact" : ""}`}>
      <div className="chart-card-title">{title}</div>
      <div className="chart-card-subtitle">{subtitle ?? " "}</div>
      {children}
      {note && <div className="chart-card-note">{note}</div>}
    </div>
  );
}
