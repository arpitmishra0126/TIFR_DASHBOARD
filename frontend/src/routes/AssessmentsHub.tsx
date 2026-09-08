import { useEffect, useState, type ComponentType, type SVGProps } from "react";

import { getOverview } from "../api/dashboard";
import DataLoadError from "../components/DataLoadError";
import {
  IconActivity,
  IconBrain,
  IconChart,
  IconChevron,
  IconClipboardCheck,
  IconGraduationCap,
  IconHeart,
  IconMonitor,
  IconUserCheck,
  IconUsers,
} from "../components/icons";
import InstrumentCoverageCard, { type AvailableInstrument } from "../components/InstrumentCoverageCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import { useRefresh } from "../context/RefreshContext";
import type { OverviewResponse } from "../types/liveDashboard";

interface PlaceholderInstrument {
  key: string;
  name: string;
  purpose: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface InstrumentGroup {
  title: string;
  available: AvailableInstrument[];
  placeholders?: PlaceholderInstrument[];
}

// Groups and per-instrument descriptions reflect the study terminology
// established by the 2026-09-03 audit (CLAUDE.md "ALL STUDY TOOLS" /
// "CURRENT REDCAP INSTRUMENTS" sections) - not invented categories. This
// list is a UI/product-status representation only: an instrument's presence
// here under "Under Development" is not evidence it exists in REDCap.
export const GROUPS: InstrumentGroup[] = [
  {
    title: "Core / Baseline",
    available: [
      { key: "registration", name: "Baseline / Participant Information", purpose: "Registry & demographic identifiers", route: "/registry", icon: IconUsers },
      { key: "ses", name: "SES", purpose: "Udai Pareek & BG Prasad socioeconomic status", route: "/demographics", icon: IconClipboardCheck },
    ],
  },
  {
    title: "Health & Behaviour",
    available: [
      { key: "child_illness_history", name: "Child Illness History", purpose: "Reported health conditions & medical history", route: "/health-screening", icon: IconHeart },
      { key: "dseq", name: "DSEQ / Screen Time", purpose: "Digital screen exposure & usage patterns", route: "/screen-time", icon: IconMonitor },
      { key: "paq_a", name: "PAQ / Physical Activity", purpose: "Physical activity questionnaire", route: "/physical-activity", icon: IconActivity },
      { key: "dietary_intake", name: "Dietary Intake", purpose: "Food-group consumption frequency", route: "/dietary-intake", icon: IconChart },
    ],
  },
  {
    title: "Social Functioning",
    available: [
      { key: "ssrs_parent", name: "SSRS - Parent", purpose: "Parent-reported social skills rating", route: "/neurodevelopment", icon: IconUserCheck },
      { key: "ssrs_child", name: "SSRS - Child", purpose: "Child self-reported social skills rating", route: "/neurodevelopment", icon: IconGraduationCap },
      { key: "ssrs_teacher", name: "SSRS - Teacher", purpose: "Teacher-reported social skills rating", route: "/neurodevelopment", icon: IconBrain },
    ],
  },
  {
    title: "Cognitive / Developmental",
    available: [],
    placeholders: [
      { key: "aser", name: "ASER Literacy and Numeracy", purpose: "Literacy & numeracy assessment", icon: IconBrain },
      { key: "sangian", name: "SANGIAN", purpose: "Cognitive assessment tool", icon: IconBrain },
      { key: "vwm", name: "Visual Working Memory", purpose: "Cognitive assessment task", icon: IconBrain },
      { key: "dccs", name: "DCCS", purpose: "Dimensional Change Card Sort task", icon: IconBrain },
      { key: "colour_detection", name: "Colour Detection Task", purpose: "Cognitive / perceptual assessment task", icon: IconBrain },
    ],
  },
  {
    title: "Anthropometry",
    available: [],
    placeholders: [{ key: "anthropometry", name: "Anthropometry / BIA", purpose: "Height, weight & body composition", icon: IconActivity }],
  },
];

function PlaceholderInstrumentCard({ instrument }: { instrument: PlaceholderInstrument }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = instrument.icon;
  return (
    <button
      type="button"
      className="instrument-card instrument-card-placeholder"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
    >
      <div className="instrument-card-top">
        <div className="instrument-card-icon instrument-card-icon-muted">
          <Icon width={18} height={18} />
        </div>
        <IconChevron width={13} height={13} className={`instrument-card-chevron${expanded ? " expanded" : ""}`} />
      </div>
      <div className="instrument-card-name">{instrument.name}</div>
      <div className="instrument-card-purpose">{instrument.purpose}</div>
      <div className="instrument-card-body">
        <div className="instrument-card-status-row">
          <StatusBadge label="Under Development" tone="neutral" />
        </div>
        {expanded ? (
          <div className="instrument-card-expanded">
            <strong>Under Development</strong>
            <br />
            Data for this assessment is not currently available in the dashboard.
          </div>
        ) : (
          <span className="instrument-card-affordance instrument-card-affordance-muted">
            Click for details <IconChevron width={10} height={10} />
          </span>
        )}
      </div>
    </button>
  );
}

export default function AssessmentsHub() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview) return <StudyDataLoader label="Loading study instruments" subLabel="Connecting to live REDCap data…" />;

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Assessments"
        subtitle="Explore each study instrument and its current data availability."
      />

      {GROUPS.map((group) => (
        <div key={group.title}>
          <SectionHeader title={group.title} />
          <div className="instrument-grid">
            {group.available.map((instrument) => (
              <InstrumentCoverageCard key={instrument.key} instrument={instrument} overview={overview} />
            ))}
            {group.placeholders?.map((instrument) => (
              <PlaceholderInstrumentCard key={instrument.key} instrument={instrument} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
