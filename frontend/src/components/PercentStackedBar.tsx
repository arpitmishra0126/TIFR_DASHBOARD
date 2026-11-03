import type { SsrsFrequencySegment } from "../types/liveDashboard";

interface PercentStackedBarProps {
  title: string;
  segments: SsrsFrequencySegment[];
  colors: string[];
}

/** Generic 100%-stacked horizontal bar for any small fixed-scale coded
 * distribution (SSRS frequency/importance items reuse this) - reuses the
 * exact `.freq-stacked-*` CSS already built for Dietary Intake's 8-point
 * scale (those class names are generic, not food-specific), parameterised
 * by caller-supplied colours instead of a fixed category list. */
export default function PercentStackedBar({ title, segments, colors }: PercentStackedBarProps) {
  const hasData = segments.some((s) => s.count > 0);
  if (!hasData) {
    return <div className="freq-stacked-empty">No valid responses recorded yet.</div>;
  }
  return (
    <div className="freq-stacked-bar" role="img" aria-label={`${title} distribution`}>
      {segments.map((seg, i) => {
        if (seg.percent <= 0) return null;
        const showLabel = seg.percent >= 12;
        return (
          <div
            key={seg.code}
            className="freq-stacked-segment"
            tabIndex={0}
            style={{ width: `${seg.percent}%`, background: colors[i % colors.length] }}
          >
            {showLabel && <span className="freq-stacked-segment-value">{seg.percent}%</span>}
            <div className="freq-stacked-tooltip" role="tooltip">
              <div className="freq-stacked-tooltip-title">{title}</div>
              <div className="freq-stacked-tooltip-category">{seg.label}</div>
              <div className="freq-stacked-tooltip-row">
                <span>Children</span>
                <strong>{seg.count}</strong>
              </div>
              <div className="freq-stacked-tooltip-row">
                <span>% of valid responses</span>
                <strong>{seg.percent}%</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
