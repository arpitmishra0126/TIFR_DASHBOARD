import { useState } from "react";
import { Link } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";

interface AvailableInstrument {
  key: string;
  name: string;
  redcapForm: string;
  route: string;
  description: string;
}

interface PlaceholderInstrument {
  key: string;
  name: string;
  description: string;
}

// Every instrument the study team has asked to see represented, split by
// whether it actually exists as usable data in the current REDCap project
// (confirmed 2026-09-03 audit) — see CLAUDE.md's "ALL STUDY TOOLS" audit
// section. This list is a UI/product-status representation only; it must
// NOT be read as evidence that a placeholder instrument exists in REDCap.
const AVAILABLE_INSTRUMENTS: AvailableInstrument[] = [
  {
    key: "registration",
    name: "Baseline / Participant Information",
    redcapForm: "Registration Form",
    route: "/registry",
    description: "Child ID, sex, date of birth, village, status — the study registry.",
  },
  {
    key: "ses",
    name: "SES (Udai Pareek / BG Prasad)",
    redcapForm: "SES questionnaire",
    route: "/demographics",
    description: "Socioeconomic status scoring and category — Demographics & SES page.",
  },
  {
    key: "chh",
    name: "Child Illness History",
    redcapForm: "Child Illness History",
    route: "/health-screening",
    description: "Named conditions and general health/medical-history indicators.",
  },
  {
    key: "dseq",
    name: "DSEQ",
    redcapForm: "Digital-Screen Exposure Questionnaire (DSEQ)",
    route: "/screen-time",
    description: "Total daily screen time distribution and screen-use indicators.",
  },
  {
    key: "paq",
    name: "PAQ",
    redcapForm: "PAQ A",
    route: "/physical-activity",
    description: "Physical activity composite scores (Item 1, Item 8, Total).",
  },
  {
    key: "dietary",
    name: "Dietary Intake",
    redcapForm: "Dietary Intake",
    route: "/dietary-intake",
    description: "Consumption frequency across 10 food groups.",
  },
  {
    key: "ssrs_parent",
    name: "SSRS — Parent",
    redcapForm: "SSRS Parent",
    route: "/neurodevelopment",
    description: "Items-answered and mean frequency/importance ratings.",
  },
  {
    key: "ssrs_child",
    name: "SSRS — Child",
    redcapForm: "SSRS Child",
    route: "/neurodevelopment",
    description: "Items-answered and mean frequency/importance ratings.",
  },
  {
    key: "ssrs_teacher",
    name: "SSRS — Teacher",
    redcapForm: "SSRS Teacher",
    route: "/neurodevelopment",
    description: "0 live completions today — summary will populate automatically once data exists.",
  },
];

const PLACEHOLDER_INSTRUMENTS: PlaceholderInstrument[] = [
  { key: "aser", name: "ASER Literacy and Numeracy", description: "Not currently available in REDCap/project data." },
  { key: "sangian", name: "SANGIAN", description: "Not currently available in REDCap/project data." },
  { key: "vwm", name: "Visual Working Memory", description: "Not currently available in REDCap/project data." },
  { key: "dccs", name: "DCCS", description: "Not currently available in REDCap/project data." },
  { key: "colour_detection", name: "Colour Detection Task", description: "Not currently available in REDCap/project data." },
  { key: "anthropometry", name: "Anthropometry / BIA", description: "Not currently available in REDCap/project data." },
];

function PlaceholderCard({ instrument }: { instrument: PlaceholderInstrument }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      className="chart-card assessment-placeholder-card"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
    >
      <div className="chart-card-title">{instrument.name}</div>
      <div style={{ margin: "var(--space-2) 0" }}>
        <StatusBadge label="Under Development" tone="neutral" />
      </div>
      {expanded && (
        <div className="chart-card-note" style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "var(--space-2)" }}>
          <strong>Under Development</strong>
          <br />
          Data for this assessment is not currently available in the dashboard.
        </div>
      )}
    </button>
  );
}

export default function AssessmentsHub() {
  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="All Study Instruments"
        subtitle="Every instrument requested for this study, organized independently — implemented instruments link to their live REDCap-backed page; the rest are honestly shown as under development."
      />

      <SectionHeader title="Available now" note="Live REDCap data — each links to its own page" />
      <div className="chart-grid three-col">
        {AVAILABLE_INSTRUMENTS.map((instrument) => (
          <Link key={instrument.key} to={instrument.route} className="chart-card assessment-instrument-card">
            <div className="chart-card-title">{instrument.name}</div>
            <div className="chart-card-subtitle">{instrument.redcapForm}</div>
            <div className="chart-card-note" style={{ borderTop: "none", paddingTop: 0 }}>
              {instrument.description}
            </div>
          </Link>
        ))}
      </div>

      <SectionHeader
        title="Under development"
        note="Requested by the study team but not currently present in the REDCap project — click a card for details"
      />
      <div className="chart-grid three-col">
        {PLACEHOLDER_INSTRUMENTS.map((instrument) => (
          <PlaceholderCard key={instrument.key} instrument={instrument} />
        ))}
      </div>
    </section>
  );
}
