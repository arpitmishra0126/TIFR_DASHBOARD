import type { ComponentType, SVGProps } from "react";
import { Link } from "react-router-dom";

import { IconChevron } from "./icons";
import ProportionBar from "./ProportionBar";
import StatusBadge from "./StatusBadge";
import type { OverviewResponse } from "../types/liveDashboard";

export type InstrumentStatus = "Completed" | "Data Available" | "No Data Available" | "Under Development";

export interface AvailableInstrument {
  key: string; // matches OverviewResponse.all_instrument_coverage[].key
  name: string;
  purpose: string;
  route: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const STATUS_BADGE_TONE: Record<InstrumentStatus, "good" | "neutral" | "warning"> = {
  Completed: "good",
  "Data Available": "good",
  "No Data Available": "neutral",
  "Under Development": "neutral",
};

export function deriveStatus(completed: number, total: number): InstrumentStatus {
  if (total > 0 && completed === total) return "Completed";
  if (completed > 0) return "Data Available";
  return "No Data Available";
}

/** Compact summary/coverage card for one live REDCap instrument - shared by
 * the Assessments hub (full catalogue) and Overview's Assessment Coverage
 * section (the 8 currently-mapped instruments). Shows only name, purpose,
 * completion/status and n/N (%) - never the detailed item-level analysis,
 * which stays exclusively on each instrument's own assessment page. */
export default function InstrumentCoverageCard({
  instrument,
  overview,
}: {
  instrument: AvailableInstrument;
  overview: OverviewResponse;
}) {
  const coverage = overview.all_instrument_coverage.find((c) => c.key === instrument.key);
  const completed = coverage?.completed_count ?? 0;
  const total = overview.total_registered;
  const percent = coverage?.percent_of_registered ?? 0;
  const status = deriveStatus(completed, total);
  const Icon = instrument.icon;

  return (
    <Link to={instrument.route} className="instrument-card instrument-card-available">
      <div className="instrument-card-top">
        <div className="instrument-card-icon">
          <Icon width={18} height={18} />
        </div>
        <IconChevron width={13} height={13} className="instrument-card-chevron" />
      </div>
      <div className="instrument-card-name">{instrument.name}</div>
      <div className="instrument-card-purpose">{instrument.purpose}</div>
      <div className="instrument-card-body">
        <div className="instrument-card-status-row">
          <StatusBadge label={status} tone={STATUS_BADGE_TONE[status]} />
          <span className="instrument-card-figure">
            {completed}/{total} ({percent}%)
          </span>
        </div>
        <ProportionBar value={completed} total={total} color={status === "No Data Available" ? "var(--baseline)" : "var(--series-1)"} />
        <span className="instrument-card-affordance">
          View assessment <IconChevron width={10} height={10} />
        </span>
      </div>
    </Link>
  );
}
