import { useEffect, useRef } from "react";

interface FullScreenLoaderProps {
  message: string;
}

// Session-lifetime flag (not React state - deliberately not reactive) that
// tracks whether ANY page has ever finished loading in this browser tab.
// A FullScreenLoader instance sets this on unmount (the exact moment its
// page's data has arrived and the real content is about to render), so the
// very next instance mounted anywhere (a later in-app navigation) reads it
// as already-true and renders as a translucent overlay instead of a fully
// opaque screen - no page file needs to opt in/pass a prop for this.
let appHasLoadedOnce = false;

// 6 evenly-spaced points per strand, staggered so each dot lags the last -
// a snapshot of a traveling sine wave, redrawn as CSS keyframes rather than
// computed per-frame. Strand B mirrors Strand A's phase so the two visibly
// cross over in the middle, like a double helix viewed edge-on.
const STRAND_POINTS = 6;
const STRAND_DELAY_STEP = 0.9 / STRAND_POINTS;

interface DnaDot {
  key: string;
  leftPercent: number;
  delay: number;
  strand: "a" | "b";
}

const DNA_DOTS: DnaDot[] = Array.from({ length: STRAND_POINTS }, (_, i) => {
  const leftPercent = (i / (STRAND_POINTS - 1)) * 100;
  const delay = i * STRAND_DELAY_STEP;
  return [
    { key: `a-${i}`, leftPercent, delay, strand: "a" as const },
    { key: `b-${i}`, leftPercent, delay, strand: "b" as const },
  ];
}).flat();

/**
 * The single, shared full-viewport loading state for the whole app.
 * - Initial load (nothing has ever rendered yet in this tab): fully opaque
 *   dark-navy background.
 * - A later in-app navigation (something has already loaded once): a
 *   translucent dark-navy overlay with a light backdrop blur, so the
 *   previously-rendered page (still mounted underneath - only the routed
 *   page's own content area swaps to this loader) stays dimly visible
 *   rather than fully hidden.
 * No sub-status text, no artificial delay - callers render this only for
 * as long as their own data is actually null.
 */
export default function FullScreenLoader({ message }: FullScreenLoaderProps) {
  // Read once per mount - correct even though it's not React state, since
  // each navigation mounts a brand-new FullScreenLoader instance.
  const isOverlayRef = useRef(appHasLoadedOnce);

  useEffect(() => {
    return () => {
      appHasLoadedOnce = true;
    };
  }, []);

  return (
    <div
      className={`fullscreen-loader${isOverlayRef.current ? " fullscreen-loader-overlay" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="fullscreen-loader-dna" aria-hidden="true">
        {DNA_DOTS.map((dot) => (
          <span
            key={dot.key}
            className={`fullscreen-loader-dna-dot fullscreen-loader-dna-dot-${dot.strand}`}
            style={{ left: `${dot.leftPercent}%`, animationDelay: `${dot.delay}s` }}
          />
        ))}
      </div>
      <div className="fullscreen-loader-text">{message}</div>
    </div>
  );
}
