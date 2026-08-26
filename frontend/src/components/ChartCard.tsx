import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  note?: string;
  children: ReactNode;
}

export default function ChartCard({ title, subtitle, note, children }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">{title}</div>
      <div className="chart-card-subtitle">{subtitle ?? " "}</div>
      {children}
      {note && <div className="chart-card-note">{note}</div>}
    </div>
  );
}
