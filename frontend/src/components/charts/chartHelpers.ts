/** Small presentation-only helpers shared by the chart components.
 * These derive display values (rounding, opacity) from data the chart
 * already received as props — they never fetch, recompute, or alter the
 * underlying dashboard figures.
 */

export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/** Opacity in [0.5, 1] proportional to value/max — used to give a single-hue
 * ("sequential") bar series a restrained sense of magnitude without
 * introducing extra colors. */
export function sequentialOpacity(value: number, max: number): number {
  if (max <= 0) return 1;
  return 0.5 + 0.5 * (value / max);
}
