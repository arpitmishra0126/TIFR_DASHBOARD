interface CoverageBarProps {
  label: string;
  count: number;
  total: number;
  percent: number;
}

export default function CoverageBar({ label, count, total, percent }: CoverageBarProps) {
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
    </div>
  );
}
