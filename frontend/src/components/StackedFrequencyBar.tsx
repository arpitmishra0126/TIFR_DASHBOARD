import { FREQUENCY_CATEGORIES } from "../lib/dietaryFrequency";
import type { DietaryFrequencySegment } from "../types/liveDashboard";

interface StackedFrequencyBarProps {
  foodGroupLabel: string;
  segments: DietaryFrequencySegment[];
}

/** A single 100% stacked horizontal bar - one segment per consumption-
 * frequency category, sized by that category's own share of the food
 * group's valid-response total. Colors are fixed per category (see
 * dietaryFrequency.ts) so a category reads identically across every food
 * group. Zero-count categories render no segment (nothing to show at 0
 * width) but remain fully inspectable via the shared legend and each food
 * group's own expandable table. */
export default function StackedFrequencyBar({ foodGroupLabel, segments }: StackedFrequencyBarProps) {
  const byCode = new Map(segments.map((s) => [s.code, s]));
  const hasData = segments.some((s) => s.count > 0);

  if (!hasData) {
    return <div className="freq-stacked-empty">No valid responses recorded yet for this food group.</div>;
  }

  return (
    <div className="freq-stacked-bar" role="img" aria-label={`${foodGroupLabel} consumption frequency distribution`}>
      {FREQUENCY_CATEGORIES.map((cat) => {
        const seg = byCode.get(cat.code);
        const pct = seg?.percent ?? 0;
        const count = seg?.count ?? 0;
        if (pct <= 0) return null;
        const showLabel = pct >= 9;
        return (
          <div
            key={cat.code}
            className="freq-stacked-segment"
            tabIndex={0}
            style={{ width: `${pct}%`, background: cat.color }}
          >
            {showLabel && <span className="freq-stacked-segment-value">{pct}%</span>}
            <div className="freq-stacked-tooltip" role="tooltip">
              <div className="freq-stacked-tooltip-title">{foodGroupLabel}</div>
              <div className="freq-stacked-tooltip-category">{cat.label}</div>
              <div className="freq-stacked-tooltip-row">
                <span>Children</span>
                <strong>{count}</strong>
              </div>
              <div className="freq-stacked-tooltip-row">
                <span>% of valid responses</span>
                <strong>{pct}%</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
