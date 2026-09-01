// Six hexagon-ring node positions the SVG paths below are drawn from.
const NODES = [
  { x: 35, y: 15 },
  { x: 65, y: 15 },
  { x: 85, y: 45 },
  { x: 65, y: 75 },
  { x: 35, y: 75 },
  { x: 15, y: 45 },
];

const RING_PATH = "M35,15 L65,15 L85,45 L65,75 L35,75 L15,45 Z";

interface StudyDataLoaderProps {
  label?: string;
  subLabel?: string;
  note?: string;
}

/**
 * Compact "study data / neural network" loading indicator — a small
 * animated hexagon of nodes standing in for study-data connectivity, used
 * wherever a page is waiting on a live REDCap fetch. Occupies only the
 * space it needs; never a full-screen takeover.
 */
export default function StudyDataLoader({
  label = "Loading study data",
  subLabel = "Connecting to live REDCap data…",
  note = "Preparing dashboard",
}: StudyDataLoaderProps) {
  return (
    <div className="study-loader" role="status" aria-live="polite">
      <svg className="study-loader-graph" viewBox="0 0 100 90" width="96" height="86" aria-hidden="true">
        <path className="study-loader-edges" d={RING_PATH} />
        <path className="study-loader-flow" d={RING_PATH} />
        {NODES.map((n, i) => (
          <circle
            key={i}
            className="study-loader-node"
            cx={n.x}
            cy={n.y}
            r={4}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </svg>
      <div className="study-loader-text">
        <div className="study-loader-label">{label}</div>
        <div className="study-loader-sublabel">{subLabel}</div>
        {note && <div className="study-loader-note">{note}</div>}
      </div>
    </div>
  );
}
