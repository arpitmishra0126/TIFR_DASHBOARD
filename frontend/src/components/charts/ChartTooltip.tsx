import type { ReactNode } from "react";

export interface ChartTooltipRow {
  label: string;
  value: ReactNode;
}

interface ChartTooltipBoxProps {
  active?: boolean;
  title?: string;
  rows?: ChartTooltipRow[];
}

/** Shared tooltip presentation for all chart components — one styling
 * implementation instead of a duplicated inline `contentStyle` per chart. */
export function ChartTooltipBox({ active, title, rows }: ChartTooltipBoxProps) {
  if (!active || !rows || rows.length === 0) return null;
  return (
    <div className="chart-tooltip">
      {title && <div className="chart-tooltip-title">{title}</div>}
      {rows.map((row) => (
        <div className="chart-tooltip-row" key={row.label}>
          <span className="chart-tooltip-row-label">{row.label}</span>
          <span className="chart-tooltip-row-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
