import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getDemographics,
  getDietaryIntake,
  getHealthScreening,
  getNeurodevelopment,
  getPhysicalActivity,
  getRegistry,
  getScreenTime,
} from "../api/dashboard";
import { percentOf } from "../components/charts/chartHelpers";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import { IconChevron } from "../components/icons";
import PageHeader from "../components/PageHeader";
import type {
  ChhCompositeIndicator,
  DemographicsResponse,
  DietaryIntakeResponse,
  HealthScreeningResponse,
  NeurodevelopmentResponse,
  PhysicalActivityResponse,
  RegistryChild,
  ScreenTimeResponse,
} from "../types/liveDashboard";

/** "Study Questionnaires" - a questionnaire-domain explorer, distinct from
 * the Dashboard (study-level monitoring) and Data Quality (integrity/QC).
 * Every figure below is read directly from the existing
 * `/dashboard/demographics`, `/dashboard/health`, `/dashboard/screen-time`,
 * `/dashboard/physical-activity`, `/dashboard/dietary-intake`,
 * `/dashboard/neurodevelopment`, and `/dashboard/registry` (for
 * Anthropometry - see note below) responses - no new backend endpoint,
 * field, or calculation was added. Assessment Tool Status (SANGIAN/VWM/
 * DCCS/CD) is deliberately NOT repeated here - it already has one primary
 * home, the Dashboard's Assessment Progress section.
 *
 * A supplied `dashboard-data.json` (explicitly marked "FICTIONAL
 * DEMONSTRATION DATA - NOT STUDY RESULTS") was reviewed for module/item
 * *labels and structure* only (e.g. "Current health", "Recent illness",
 * "Television", "Home media environment") - its wording is reused below
 * where it matches our real fields, but none of its numbers were used;
 * every count/percent here is computed from the live endpoints above.
 *
 * SES scope note: a live-code audit found 8 Udai Pareek sub-items (head of
 * family occupation, social participation, house type, farm animals,
 * education, land, assets, household-size band) exist only inside the
 * Excel/CSV export's own tables, never in a JSON dashboard endpoint, and
 * caste is excluded everywhere by an explicit data-sensitivity policy in
 * `export_service.py`. This page shows only the 4 SES indicators genuinely
 * available here (Udai Pareek category, BG Prasad category, per-capita
 * income, household size) - the sub-items are not fabricated.
 *
 * Anthropometry has no dedicated measurement summary endpoint (only its
 * own completion field, per CLAUDE.md) - its card shows real completion
 * coverage (aggregated client-side from the existing `/dashboard/registry`
 * per-child `instrument_status.anthropometry`, same aggregation pattern
 * already used by the Data Quality page) and an explicit "data available
 * for detailed analysis" note instead of a fabricated measurement metric. */

type Tone = "blue" | "teal" | "violet" | "amber";

interface DetailRow {
  label: string;
  value: string;
  percent?: number;
}

interface QuestionnaireRow {
  id: string;
  name: string;
  descriptor: string;
  valueText: string;
  percent?: number;
  detailTitle?: string;
  detailSubtitle?: string;
  detailRows: DetailRow[];
  linkTo?: string;
  linkLabel?: string;
}

interface QuestionnaireGroup {
  label: string;
  rows: QuestionnaireRow[];
}

interface QuestionnaireDomain {
  number: string;
  key: string;
  label: string;
  title: string;
  description: string;
  tone: Tone;
  groups: QuestionnaireGroup[];
  footnote?: string;
}

function compositeDetailRows(c: ChhCompositeIndicator): DetailRow[] {
  return [
    { label: "Any component Yes", value: `${c.yes_count}`, percent: percentOf(c.yes_count, c.valid_n) },
    { label: "All components No", value: `${c.no_count}` },
    { label: "Unknown / missing", value: `${c.unknown_or_missing_count}` },
    { label: "Answered (Valid N)", value: `${c.valid_n} of ${c.total} registered` },
  ];
}

function categoryDetailRows(dist: { code: string; count: number }[]): DetailRow[] {
  const total = dist.reduce((sum, d) => sum + d.count, 0);
  return dist.map((d) => ({ label: d.code, value: `${d.count}`, percent: percentOf(d.count, total) }));
}

function buildDomains(
  demo: DemographicsResponse,
  health: HealthScreeningResponse,
  screen: ScreenTimeResponse,
  paq: PhysicalActivityResponse,
  dietary: DietaryIntakeResponse,
  neuro: NeurodevelopmentResponse,
  registry: RegistryChild[],
): QuestionnaireDomain[] {
  const total = demo.total_registered;
  const chh = health.chh;

  // --- 01 SES ---------------------------------------------------------
  const udaiTotal = demo.udai_pareek_category_distribution.reduce((s, d) => s + d.count, 0);
  const prasadTotal = demo.bg_prasad_category_distribution.reduce((s, d) => s + d.count, 0);
  const sesRows: QuestionnaireRow[] = [
    {
      id: "01",
      name: "Udai Pareek SES Category",
      descriptor: "Composite socioeconomic classification",
      valueText: `${udaiTotal}/${total}`,
      percent: percentOf(udaiTotal, total),
      detailRows: categoryDetailRows(demo.udai_pareek_category_distribution),
    },
    {
      id: "02",
      name: "BG Prasad Category",
      descriptor: "Composite socioeconomic classification",
      valueText: `${prasadTotal}/${total}`,
      percent: percentOf(prasadTotal, total),
      detailRows: categoryDetailRows(demo.bg_prasad_category_distribution),
    },
    {
      id: "03",
      name: "Per-Capita Income",
      descriptor: "Monthly household income per capita",
      valueText: demo.per_capita_income_summary ? `n=${demo.per_capita_income_summary.count}/${total}` : "No data",
      percent: demo.per_capita_income_summary ? percentOf(demo.per_capita_income_summary.count, total) : undefined,
      detailRows: demo.per_capita_income_summary
        ? [
            { label: "Mean", value: `₹${demo.per_capita_income_summary.mean.toFixed(0)}` },
            { label: "Minimum", value: `₹${demo.per_capita_income_summary.minimum.toFixed(0)}` },
            { label: "Maximum", value: `₹${demo.per_capita_income_summary.maximum.toFixed(0)}` },
            { label: "Recorded (Valid N)", value: `${demo.per_capita_income_summary.count} of ${total}` },
          ]
        : [{ label: "Status", value: "No data acquired" }],
    },
    {
      id: "04",
      name: "Household Size",
      descriptor: "Number of household members",
      valueText: demo.household_size_summary ? `n=${demo.household_size_summary.count}/${total}` : "No data",
      percent: demo.household_size_summary ? percentOf(demo.household_size_summary.count, total) : undefined,
      detailRows: demo.household_size_summary
        ? [
            { label: "Mean", value: demo.household_size_summary.mean.toFixed(1) },
            { label: "Minimum", value: `${demo.household_size_summary.minimum}` },
            { label: "Maximum", value: `${demo.household_size_summary.maximum}` },
            { label: "Recorded (Valid N)", value: `${demo.household_size_summary.count} of ${total}` },
          ]
        : [{ label: "Status", value: "No data acquired" }],
    },
  ];

  // --- 02 Health (Baseline Health and Illness History) ------------------
  const healthRows: QuestionnaireRow[] = [
    {
      id: "A",
      name: "Current Health",
      descriptor: "Current illness, symptoms, activity impact",
      valueText: `${chh.current_health.currently_ill.yes_count}/${chh.current_health.currently_ill.valid_n}`,
      percent: chh.current_health.currently_ill.percent_yes,
      detailRows: [
        { label: "Currently ill", value: `${chh.current_health.currently_ill.yes_count}`, percent: chh.current_health.currently_ill.percent_yes },
        {
          label: "Any current symptom",
          value: `${chh.current_health.any_current_symptom.yes_count}`,
          percent: chh.current_health.any_current_symptom.percent_yes,
        },
        {
          label: "Activity/school affected",
          value: `${chh.current_health.activity_or_school_affected.yes_count}`,
          percent: chh.current_health.activity_or_school_affected.percent_yes,
        },
      ],
    },
    {
      id: "B",
      name: "Recent Illness",
      descriptor: "Consultation history, illness frequency, missed school",
      valueText: `${chh.recent_illness.consultation_required.yes_count}/${chh.recent_illness.consultation_required.valid_n}`,
      percent: chh.recent_illness.consultation_required.percent_yes,
      detailRows: [
        {
          label: "Consultation required",
          value: `${chh.recent_illness.consultation_required.yes_count}`,
          percent: chh.recent_illness.consultation_required.percent_yes,
        },
        { label: "Recurrent illness", value: `${chh.recent_illness.recurrent_illness.count}`, percent: chh.recent_illness.recurrent_illness.percent },
        {
          label: "Missed school days (mean)",
          value: chh.recent_illness.school_days_missed_summary.mean !== null ? chh.recent_illness.school_days_missed_summary.mean.toFixed(1) : "No data",
        },
      ],
    },
    {
      id: "C",
      name: "Major or Chronic Illness",
      descriptor: "Diagnosed conditions, chronic history",
      valueText: `${chh.chronic_illness.any_listed_condition.yes_count}/${chh.chronic_illness.any_listed_condition.valid_n}`,
      percent: chh.chronic_illness.any_listed_condition.percent_yes,
      detailRows: compositeDetailRows(chh.chronic_illness.any_listed_condition),
    },
    {
      id: "D",
      name: "Neurological History",
      descriptor: "Seizures, fainting, infection, head injury",
      valueText: `${chh.neurological.any_neurological_history.yes_count}/${chh.neurological.any_neurological_history.valid_n}`,
      percent: chh.neurological.any_neurological_history.percent_yes,
      detailRows: [
        { label: "Seizures", value: `${chh.neurological.seizure_history.yes_count}`, percent: chh.neurological.seizure_history.percent_yes },
        { label: "Fainting", value: `${chh.neurological.fainting_history.yes_count}`, percent: chh.neurological.fainting_history.percent_yes },
        { label: "CNS infection", value: `${chh.neurological.cns_infection_history.yes_count}`, percent: chh.neurological.cns_infection_history.percent_yes },
        { label: "Head injury", value: `${chh.neurological.head_injury_history.yes_count}`, percent: chh.neurological.head_injury_history.percent_yes },
      ],
    },
    {
      id: "E",
      name: "Vision and Hearing",
      descriptor: "Vision/hearing difficulty, glasses, ear infection",
      valueText: `${chh.sensory.any_sensory_concern.yes_count}/${chh.sensory.any_sensory_concern.valid_n}`,
      percent: chh.sensory.any_sensory_concern.percent_yes,
      detailRows: [
        { label: "Difficulty seeing", value: `${chh.sensory.vision_difficulty.yes_count}`, percent: chh.sensory.vision_difficulty.percent_yes },
        { label: "Currently wears glasses", value: `${chh.sensory.uses_glasses.yes_count}`, percent: chh.sensory.uses_glasses.percent_yes },
        { label: "Difficulty hearing", value: `${chh.sensory.hearing_difficulty.yes_count}`, percent: chh.sensory.hearing_difficulty.percent_yes },
        {
          label: "Recurrent ear infection",
          value: `${chh.sensory.recurrent_ear_infection.yes_count}`,
          percent: chh.sensory.recurrent_ear_infection.percent_yes,
        },
      ],
    },
    {
      id: "F",
      name: "Development and Learning",
      descriptor: "Developmental concerns, diagnosis",
      valueText: `${chh.developmental.any_developmental_concern.yes_count}/${chh.developmental.any_developmental_concern.valid_n}`,
      percent: chh.developmental.any_developmental_concern.percent_yes,
      detailRows: [
        {
          label: "Any developmental concern",
          value: `${chh.developmental.any_developmental_concern.yes_count}`,
          percent: chh.developmental.any_developmental_concern.percent_yes,
        },
        { label: "Diagnosed condition", value: `${chh.developmental.diagnosed_condition.yes_count}`, percent: chh.developmental.diagnosed_condition.percent_yes },
      ],
    },
    {
      id: "G",
      name: "Hospitalisation and Treatment",
      descriptor: "Hospitalisation, medication, allergy",
      valueText: `${chh.hospitalisation.major_treatment_history.yes_count}/${chh.hospitalisation.major_treatment_history.valid_n}`,
      percent: chh.hospitalisation.major_treatment_history.percent_yes,
      detailRows: [
        { label: "Ever hospitalised", value: `${chh.hospitalisation.ever_hospitalised.yes_count}`, percent: chh.hospitalisation.ever_hospitalised.percent_yes },
        { label: "Regular medication", value: `${chh.hospitalisation.regular_medication.yes_count}`, percent: chh.hospitalisation.regular_medication.percent_yes },
        { label: "Known allergy", value: `${chh.hospitalisation.known_allergy.yes_count}`, percent: chh.hospitalisation.known_allergy.percent_yes },
      ],
    },
    {
      id: "H",
      name: "Functional Health",
      descriptor: "Functional limitation, overall health",
      valueText: `${chh.functional_health.any_functional_limitation.yes_count}/${chh.functional_health.any_functional_limitation.valid_n}`,
      percent: chh.functional_health.any_functional_limitation.percent_yes,
      detailRows: [
        {
          label: "Any functional limitation",
          value: `${chh.functional_health.any_functional_limitation.yes_count}`,
          percent: chh.functional_health.any_functional_limitation.percent_yes,
        },
        { label: "Suboptimal health", value: `${chh.functional_health.suboptimal_health.count}`, percent: chh.functional_health.suboptimal_health.percent },
      ],
    },
    {
      id: "I",
      name: "Assessment Day",
      descriptor: "Fitness for assessment, assessor decision",
      valueText: `${chh.assessment_day.any_assessment_day_concern_count}/${chh.assessment_day.any_assessment_day_concern_total}`,
      percent: chh.assessment_day.any_assessment_day_concern_percent,
      detailRows: [
        {
          label: "Any assessment-day concern",
          value: `${chh.assessment_day.any_assessment_day_concern_count}`,
          percent: chh.assessment_day.any_assessment_day_concern_percent,
        },
        ...categoryDetailRows(chh.assessment_day.assessment_decision_distribution).map((r) => ({ ...r, label: `Decision: ${r.label}` })),
      ],
    },
  ];

  // --- 03 DSEQ (Digital Screen Exposure) --------------------------------
  const findDevice = (needle: string) => screen.by_device.find((d) => d.device.toLowerCase().includes(needle));
  const television = findDevice("television");
  const smartphone = findDevice("smartphone") ?? findDevice("phone");
  const laptop = findDevice("laptop") ?? findDevice("computer");

  const deviceRow = (id: string, name: string, dev: { mean_minutes: number | null; valid_n: number } | undefined): QuestionnaireRow => ({
    id,
    name,
    descriptor: "Estimated daily use",
    valueText: dev && dev.mean_minutes !== null ? `${Math.round(dev.mean_minutes)} min (n=${dev.valid_n})` : "No duration data",
    percent: dev ? percentOf(dev.valid_n, total) : undefined,
    detailRows:
      dev && dev.mean_minutes !== null
        ? [
            { label: "Mean estimated minutes/day", value: `${Math.round(dev.mean_minutes)}` },
            { label: "Recorded (Valid N)", value: `${dev.valid_n} of ${total}` },
          ]
        : [{ label: "Status", value: "No duration field for this device" }],
  });

  const purposeTotal = screen.purpose_distribution.reduce((s, d) => s + d.count, 0);
  const totalScreenAnswered = screen.total_screen_time_distribution.reduce((s, d) => s + d.count, 0);

  const dseqRows: QuestionnaireRow[] = [
    deviceRow("A1", "Television", television),
    deviceRow("A2", "Smartphone/Tablet", smartphone),
    deviceRow("A3", "Laptop/Computer", laptop),
    {
      id: "A4",
      name: "Home Media Environment",
      descriptor: "Estimated average daily screen time (all devices)",
      valueText:
        screen.average_daily_summary.mean !== null
          ? `${Math.round(screen.average_daily_summary.mean)} min (n=${screen.average_daily_summary.valid_n})`
          : "No data",
      percent: percentOf(screen.average_daily_summary.valid_n, total),
      detailRows: [
        { label: "Mean", value: screen.average_daily_summary.mean !== null ? `${Math.round(screen.average_daily_summary.mean)} min` : "No data" },
        { label: "Median", value: screen.average_daily_summary.median !== null ? `${Math.round(screen.average_daily_summary.median)} min` : "No data" },
        { label: "Recorded (Valid N)", value: `${screen.average_daily_summary.valid_n} of ${total}` },
      ],
      linkTo: "/screen-time",
      linkLabel: "View full analysis",
    },
    {
      id: "A5",
      name: "Total Daily Screen Time",
      descriptor: "DSEQ Q10 category (secondary, descriptive)",
      valueText: totalScreenAnswered > 0 ? `n=${totalScreenAnswered}/${total}` : "No data",
      percent: percentOf(totalScreenAnswered, total),
      detailRows: categoryDetailRows(screen.total_screen_time_distribution),
    },
    {
      id: "B1",
      name: "Physical Activity (Outdoor Play)",
      descriptor: "School-day and holiday outdoor play duration",
      valueText:
        screen.physical_activity_school_day_summary.mean !== null
          ? `${Math.round(screen.physical_activity_school_day_summary.mean)} min (n=${screen.physical_activity_school_day_summary.valid_n})`
          : "No data",
      percent: percentOf(screen.physical_activity_school_day_summary.valid_n, total),
      detailRows: [
        {
          label: "School day (mean)",
          value: screen.physical_activity_school_day_summary.mean !== null ? `${Math.round(screen.physical_activity_school_day_summary.mean)} min` : "No data",
        },
        {
          label: "Holiday/weekend (mean)",
          value: screen.physical_activity_weekend_summary.mean !== null ? `${Math.round(screen.physical_activity_weekend_summary.mean)} min` : "No data",
        },
        { label: "Recorded (Valid N)", value: `${screen.physical_activity_school_day_summary.valid_n} of ${total}` },
      ],
      linkTo: "/screen-time",
      linkLabel: "View full analysis",
    },
    {
      id: "C1",
      name: "Media Behaviour",
      descriptor: "Primary purpose of screen use",
      valueText: purposeTotal > 0 ? `n=${purposeTotal}/${total}` : "No data",
      percent: percentOf(purposeTotal, total),
      detailRows: categoryDetailRows(screen.purpose_distribution),
    },
    {
      id: "C2",
      name: "Supervision and Household Rules",
      descriptor: "Adult supervision, household screen rules",
      valueText: `n=${screen.household_rules_valid_n}/${total}`,
      percent: percentOf(screen.household_rules_valid_n, total),
      detailRows: [...categoryDetailRows(screen.supervision_distribution), ...categoryDetailRows(screen.household_rules_distribution)],
    },
  ];

  // --- 04 Physical Activity (PAQ-C) -------------------------------------
  const paqRows: QuestionnaireRow[] = [
    {
      id: "01",
      name: "Instrument Completion",
      descriptor: "PAQ-C questionnaire completion",
      valueText: `${paq.completion.completed}/${paq.completion.total_registered}`,
      percent: paq.completion.percent,
      detailRows: [{ label: "Completed", value: `${paq.completion.completed}`, percent: paq.completion.percent }],
    },
    {
      id: "02",
      name: "Final PAQ-C Score",
      descriptor: "Items 1-8 composite (excludes item 9)",
      valueText: paq.total_summary.mean !== null ? `mean ${paq.total_summary.mean.toFixed(2)} (n=${paq.total_summary.valid_n})` : "No data",
      percent: percentOf(paq.total_summary.valid_n, paq.completion.total_registered),
      detailRows: paq.item_scores.map((it) => ({ label: it.label, value: it.mean !== null ? it.mean.toFixed(2) : "No data" })),
    },
  ];

  // --- 06 Dietary Intake --------------------------------------------------
  const dietaryRows: QuestionnaireRow[] = [
    {
      id: "01",
      name: "Instrument Completion",
      descriptor: "Dietary Intake questionnaire completion",
      valueText: `${dietary.completion.completed}/${dietary.completion.total_registered}`,
      percent: dietary.completion.percent,
      detailRows: dietary.items.map((it) => ({ label: it.field_label, value: `n=${it.valid_n}`, percent: it.percent_valid })),
    },
  ];

  // --- 05 Anthropometry (completion-only) ---------------------------------
  const anthroCompleted = registry.filter((c) => c.instrument_status.anthropometry).length;
  const anthroRows: QuestionnaireRow[] = [
    {
      id: "01",
      name: "Instrument Completion",
      descriptor: "Anthropometry Assessment Form completion",
      valueText: `${anthroCompleted}/${total}`,
      percent: percentOf(anthroCompleted, total),
      detailRows: [{ label: "Completed", value: `${anthroCompleted}`, percent: percentOf(anthroCompleted, total) }],
    },
  ];

  // --- 07 Neurodevelopment (SSRS Parent/Child/Teacher) --------------------
  const ssrsRow = (id: string, name: string, s: NeurodevelopmentResponse["parent"]): QuestionnaireRow => ({
    id,
    name,
    descriptor: "Instrument completion, avg frequency/importance rating",
    valueText: `${s.completed_count}/${s.total_registered}`,
    percent: s.percent,
    detailRows: [
      { label: "Completed", value: `${s.completed_count}`, percent: s.percent },
      { label: "Children with any data", value: `${s.children_with_any_data}` },
      { label: "Avg frequency rating", value: s.avg_frequency_summary.mean !== null ? s.avg_frequency_summary.mean.toFixed(2) : "No data" },
      { label: "Avg importance rating", value: s.avg_importance_summary.mean !== null ? s.avg_importance_summary.mean.toFixed(2) : "No data" },
    ],
    linkTo: "/neurodevelopment",
    linkLabel: "View full analysis",
  });

  const neuroRows: QuestionnaireRow[] = [
    ssrsRow("01", "SSRS Parent", neuro.parent),
    ssrsRow("02", "SSRS Child", neuro.child),
    ssrsRow("03", "SSRS Teacher", neuro.teacher),
  ];

  return [
    {
      number: "01",
      key: "ses",
      label: "SES",
      title: "Socioeconomic Status",
      description: "Udai Pareek + BG Prasad",
      tone: "blue",
      groups: [{ label: "", rows: sesRows }],
      footnote:
        "8 additional Udai Pareek sub-items (occupation, social participation, house type, farm animals, education, land, assets, household-size band) are export-only today, not exposed on any live dashboard endpoint.",
    },
    {
      number: "02",
      key: "health",
      label: "HEALTH",
      title: "Baseline Health and Illness History",
      description: "Child Illness History questionnaire",
      tone: "teal",
      groups: [
        { label: "Current and Recent", rows: healthRows.slice(0, 2) },
        { label: "Health / Developmental History", rows: healthRows.slice(2, 7) },
        { label: "Functional / Assessment Day", rows: healthRows.slice(7, 9) },
      ],
    },
    {
      number: "03",
      key: "dseq",
      label: "DSEQ",
      title: "Digital Screen Exposure",
      description: "Screen exposure, physical activity, media behaviour",
      tone: "violet",
      groups: [
        { label: "Screen Exposure", rows: dseqRows.slice(0, 5) },
        { label: "Physical Activity", rows: dseqRows.slice(5, 6) },
        { label: "Media Behaviour", rows: dseqRows.slice(6, 8) },
      ],
    },
    {
      number: "04",
      key: "paq",
      label: "PHYSICAL ACTIVITY",
      title: "PAQ-C",
      description: "Physical Activity Questionnaire",
      tone: "teal",
      groups: [{ label: "", rows: paqRows }],
    },
    {
      number: "05",
      key: "anthropometry",
      label: "ANTHROPOMETRY",
      title: "Anthropometry Assessment Form",
      description: "Height, weight and related measurements",
      tone: "blue",
      groups: [{ label: "", rows: anthroRows }],
      footnote: "Only instrument completion is exposed on a live dashboard endpoint today - individual measurements are available for detailed analysis in REDCap directly.",
    },
    {
      number: "06",
      key: "dietary",
      label: "DIETARY INTAKE",
      title: "Dietary Intake",
      description: "Food-group consumption frequency",
      tone: "amber",
      groups: [{ label: "", rows: dietaryRows }],
    },
    {
      number: "07",
      key: "neurodevelopment",
      label: "NEURODEVELOPMENT",
      title: "SSRS Parent / Child / Teacher",
      description: "Social skills rating scale, by rater",
      tone: "violet",
      groups: [{ label: "", rows: neuroRows }],
    },
  ];
}

function IndicatorRow({
  row,
  expanded,
  onToggle,
}: {
  row: QuestionnaireRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="sq-row-wrap">
      <button type="button" className={`sq-row${expanded ? " sq-row-expanded" : ""}`} onClick={onToggle}>
        <span className="sq-row-id">{row.id}</span>
        <span className="sq-row-text">
          <span className="sq-row-name">{row.name}</span>
          <span className="sq-row-descriptor">{row.descriptor}</span>
          {row.percent !== undefined && (
            <div className="monitor-bar monitor-bar-tone-blue sq-row-bar">
              <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }} />
            </div>
          )}
        </span>
        <span className="sq-row-value">
          <span className="sq-row-value-count">{row.valueText}</span>
          {row.percent !== undefined && <span className="sq-row-value-percent">{row.percent}%</span>}
        </span>
        <IconChevron width={12} height={12} className={`sq-row-chevron${expanded ? " sq-row-chevron-open" : ""}`} />
      </button>

      {expanded && (
        <div className="sq-row-detail">
          {row.detailTitle && <div className="sq-row-detail-title">{row.detailTitle}</div>}
          {row.detailSubtitle && <div className="sq-row-detail-subtitle">{row.detailSubtitle}</div>}
          <div className="sq-row-detail-rows">
            {row.detailRows.map((dr, idx) => (
              <div className="sq-row-detail-item" key={`${dr.label}-${idx}`}>
                <span className="sq-row-detail-label">{dr.label}</span>
                <span className="sq-row-detail-value">{dr.value}</span>
                {dr.percent !== undefined && (
                  <div className="monitor-bar monitor-bar-tone-blue">
                    <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, dr.percent))}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {row.linkTo && (
            <Link to={row.linkTo} className="monitor-detail-link">
              {row.linkLabel ?? "View full analysis"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function DomainCard({ domain, expandedRow, onToggleRow }: { domain: QuestionnaireDomain; expandedRow: string | null; onToggleRow: (rowId: string) => void }) {
  return (
    <div className={`monitor-section sq-domain-panel monitor-tone-${domain.tone}`}>
      <div className="sq-domain-head">
        <span className="sq-domain-number">{domain.number}</span>
        <div>
          <div className="sq-domain-label">{domain.label}</div>
          <div className="sq-domain-title">{domain.title}</div>
          <div className="sq-domain-description">{domain.description}</div>
        </div>
      </div>

      {domain.groups.map((group) => (
        <div key={group.label || "default"}>
          {group.label && <div className="sq-group-band">{group.label}</div>}
          {group.rows.map((row) => (
            <IndicatorRow key={row.id} row={row} expanded={expandedRow === row.id} onToggle={() => onToggleRow(row.id)} />
          ))}
        </div>
      ))}

      {domain.footnote && <p className="monitor-section-footnote">{domain.footnote}</p>}
    </div>
  );
}

export default function StudyQuestionnaires() {
  const [demographics, setDemographics] = useState<DemographicsResponse | null>(null);
  const [health, setHealth] = useState<HealthScreeningResponse | null>(null);
  const [screen, setScreen] = useState<ScreenTimeResponse | null>(null);
  const [paq, setPaq] = useState<PhysicalActivityResponse | null>(null);
  const [dietary, setDietary] = useState<DietaryIntakeResponse | null>(null);
  const [neuro, setNeuro] = useState<NeurodevelopmentResponse | null>(null);
  const [registry, setRegistry] = useState<RegistryChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [expanded, setExpanded] = useState<{ domain: string; rowId: string } | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      getDemographics(),
      getHealthScreening(),
      getScreenTime(),
      getPhysicalActivity(),
      getDietaryIntake(),
      getNeurodevelopment(),
      getRegistry({ limit: 500 }),
    ])
      .then(([d, h, s, p, di, n, r]) => {
        setDemographics(d);
        setHealth(h);
        setScreen(s);
        setPaq(p);
        setDietary(di);
        setNeuro(n);
        setRegistry(r.children);
      })
      .catch((err: Error) => setError(err.message));
  }, [retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!demographics || !health || !screen || !paq || !dietary || !neuro || !registry) {
    return <FullScreenLoader message="Loading Study Questionnaires..." />;
  }

  const domains = buildDomains(demographics, health, screen, paq, dietary, neuro, registry);
  const total = demographics.total_registered;

  const toggleRow = (domainKey: string, rowId: string) => {
    setExpanded((current) => (current?.domain === domainKey && current.rowId === rowId ? null : { domain: domainKey, rowId }));
  };

  // --- Top KPI strip: only values genuinely computable from the data
  // already fetched above - every denominator shown explicitly.
  const udaiScored = demographics.udai_pareek_category_distribution.reduce((s, d) => s + d.count, 0);
  const currentlyIll = health.chh.current_health.currently_ill;
  const highScreenTimeCount = screen.total_screen_time_distribution
    .filter((d) => d.code.includes("2-4") || d.code.toLowerCase().includes("more than 4"))
    .reduce((s, d) => s + d.count, 0);
  const totalScreenAnswered = screen.total_screen_time_distribution.reduce((s, d) => s + d.count, 0);

  return (
    <section className="overview-page">
      <PageHeader
        eyebrow="Study Questionnaires"
        title="Study Questionnaires"
        subtitle="Overview of key questionnaire domains and indicators. Select any row to view details."
      />

      <div className="stat-strip">
        <div className="stat-block">
          <span className="stat-block-label">Children in Selection</span>
          <span className="stat-block-value">{total.toLocaleString()}</span>
          <span className="stat-block-footnote">Valid questionnaire population</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Udai Pareek Scored</span>
          <span className="stat-block-value">
            {udaiScored}/{total}
          </span>
          <span className="stat-block-footnote">{percentOf(udaiScored, total)}% classified</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Current Health Concern</span>
          <span className="stat-block-value">
            {currentlyIll.yes_count}/{currentlyIll.valid_n}
          </span>
          <span className="stat-block-footnote">{currentlyIll.percent_yes}% of {currentlyIll.valid_n} respondents</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">High Daily Screen Time</span>
          <span className="stat-block-value">{totalScreenAnswered > 0 ? `${highScreenTimeCount}/${totalScreenAnswered}` : "No data"}</span>
          <span className="stat-block-footnote">DSEQ Q10 "2 hours or more" bands</span>
        </div>
      </div>

      {/* CSS multi-column ("masonry") layout, not a 2-col CSS Grid - a grid
          row-locks to its tallest cell, which is exactly what produced the
          previous version's large empty gaps below shorter cards. Columns
          pack top-to-bottom instead, so every card sizes to its own
          content and no card is ever stranded beside empty space. */}
      <div className="sq-domain-columns">
        {domains
          .filter((d) => d.key !== "neurodevelopment")
          .map((domain) => (
            <DomainCard
              key={domain.key}
              domain={domain}
              expandedRow={expanded?.domain === domain.key ? expanded.rowId : null}
              onToggleRow={(rowId) => toggleRow(domain.key, rowId)}
            />
          ))}
      </div>

      {domains
        .filter((d) => d.key === "neurodevelopment")
        .map((domain) => (
          <DomainCard
            key={domain.key}
            domain={domain}
            expandedRow={expanded?.domain === domain.key ? expanded.rowId : null}
            onToggleRow={(rowId) => toggleRow(domain.key, rowId)}
          />
        ))}
    </section>
  );
}
