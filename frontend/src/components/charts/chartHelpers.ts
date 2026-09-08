/** Small presentation-only helpers shared by the chart components.
 * These derive display values (rounding, opacity) from data the chart
 * already received as props - they never fetch, recompute, or alter the
 * underlying dashboard figures.
 */

export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/** Opacity in [0.5, 1] proportional to value/max - used to give a single-hue
 * ("sequential") bar series a restrained sense of magnitude without
 * introducing extra colors. */
export function sequentialOpacity(value: number, max: number): number {
  if (max <= 0) return 1;
  return 0.5 + 0.5 * (value / max);
}

/** Greedy word-wrap of a category label into lines of at most `maxChars`
 * characters - never truncates or drops text (a single word longer than
 * `maxChars` is hard-split rather than cut), so long REDCap choice labels
 * (including non-Latin scripts) stay fully readable across multiple lines
 * instead of overflowing a fixed-width axis. */
export function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (word.length > maxChars) {
      flush();
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      flush();
      current = word;
    } else {
      current = candidate;
    }
  }
  flush();

  return lines.length ? lines : [text];
}
