import { percentOf } from "./charts/chartHelpers";

interface ProportionBarProps {
  value: number;
  total: number;
  color?: string;
}

/** A compact single-value proportion indicator (value/total) — for places
 * where only a count and its denominator exist (no separate "No" count to
 * compose against), so a full response-composition chart would overstate
 * what the data actually distinguishes. */
export default function ProportionBar({ value, total, color = "var(--series-1)" }: ProportionBarProps) {
  const pct = percentOf(value, total);
  return (
    <div className="proportion-bar" role="img" aria-label={`${value} of ${total} (${pct}%)`}>
      <div className="proportion-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}
