import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import { percentOf } from "../components/charts/chartHelpers";
import ConditionCompositionChart from "../components/charts/ConditionCompositionChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import FullScreenLoader from "../components/FullScreenLoader";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type {
  ChhCompositeIndicator,
  ChhNumericSummary,
  ChhPrevalenceItem,
  ChhThreeWayBreakdown,
  ConditionIndicator,
  HealthScreeningResponse,
} from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

function CompositionLegend() {
  return (
    <div className="composition-legend">
      <span className="composition-legend-item">
        <span className="composition-legend-swatch" style={{ background: "var(--series-1)" }} />
        Yes
      </span>
      <span className="composition-legend-item">
        <span className="composition-legend-swatch" style={{ background: "var(--baseline)" }} />
        No
      </span>
      <span className="composition-legend-item">
        <span className="composition-legend-swatch" style={{ background: "var(--series-4)" }} />
        Don't know
      </span>
      <span> - each bar is 100% of that item's own valid respondents</span>
    </div>
  );
}

function DetailTable({ rows }: { rows: ConditionIndicator[] }) {
  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Yes</th>
            <th>No</th>
            <th>Don't know</th>
            <th>Valid N</th>
            <th>Asked N</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.label}>
              <td>{c.label}</td>
              <td>
                {c.yes_count} ({c.percent_yes}%)
              </td>
              <td>{c.no_count}</td>
              <td>{c.dont_know_count}</td>
              <td>{c.valid_n}</td>
              <td>{c.asked_n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Reshapes a full Yes/No/Don't-know ConditionIndicator down to the
 * compact {count, total, percent} shape PrevalenceList already renders -
 * used to fold several individually-shaped raw items (e.g. the 4 basic
 * neurological/sensory/hospitalisation indicators) into ONE compact
 * grouped list instead of one KPI card each. The Don't-know/Asked-N detail
 * this drops from the compact view is never lost - every caller pairs this
 * with a DetailDisclosure + DetailTable showing the exact Yes/No/Don't
 * know/Valid N/Asked N values for the same items. */
function conditionToPrevalence(indicator: ConditionIndicator): ChhPrevalenceItem {
  return { label: indicator.label, count: indicator.yes_count, total: indicator.valid_n, percent: indicator.percent_yes };
}

/** Compact grouped-indicator panel (2026-09-15 page-wide redesign) - the
 * ONE shared building block every CHH section now uses for its flat and
 * conditionally-denominated indicators (single Yes/No items, and items
 * whose own denominator is a subset of the section, like "treated head
 * injury" among those with a head injury): short label + n/N + percent
 * per indicator, wrapping naturally across one or more rows in a single
 * rounded panel, instead of one large KPI card each. Purely a display
 * regrouping - every count/total/percent shown is exactly what the
 * underlying ConditionIndicator/ChhPrevalenceItem field already computes,
 * nothing recalculated. Composite indicators (which need their own
 * "unknown/missing" sublabel) and true numeric summaries (mean/median/
 * range) are deliberately never folded in here - callers keep those as a
 * separate, compact `.chh-highlight-row` of KpiCards, only where that
 * metric is genuinely non-duplicative of the group above it. */
function IndicatorGroup({ title, items }: { title: string; items: ChhPrevalenceItem[] }) {
  const hasData = items.length > 0 && items.some((i) => i.total > 0);
  return (
    <div className="indicator-group">
      <div className="indicator-group-title">{title}</div>
      {hasData ? (
        <div className="indicator-group-grid">
          {items.map((item) => (
            <div className="indicator-group-item" key={item.label}>
              <span className="indicator-group-item-label">{item.label}</span>
              <span className="indicator-group-item-value">
                {item.total > 0 ? `${item.count}/${item.total} · ${item.percent}%` : "No data"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="indicator-group-empty">No respondents in this denominator yet.</div>
      )}
    </div>
  );
}

/** Composite-variable KPI (spec Section 1) - Yes if any component is Yes,
 * No only if every component is No, otherwise unknown/missing - the
 * "unknown or missing" count is always shown, never silently folded into
 * No. */
function CompositeKpi({ indicator, tone = "neutral" }: { indicator: ChhCompositeIndicator; tone?: "blue" | "violet" | "aqua" | "amber" | "neutral" }) {
  const value = indicator.valid_n > 0 ? `${indicator.yes_count}/${indicator.valid_n}` : "No data";
  const sublabel =
    indicator.valid_n > 0
      ? `${indicator.percent_yes}% of ${indicator.valid_n} classifiable · ${indicator.unknown_or_missing_count} unknown/missing`
      : `${indicator.unknown_or_missing_count} unknown/missing of ${indicator.total} registered`;
  return <KpiCard label={indicator.label} value={value} sublabel={sublabel} tone={tone} />;
}

/** A list of prevalence items each with their own denominator - reused for
 * symptom/domain/function/allergy-type/performance-condition prevalence
 * AND (via `conditionToPrevalence`) for grouping several raw Yes/No
 * indicators into one compact panel instead of one KPI card each. Matches
 * the "Overview" health-signal list pattern already used elsewhere on the
 * dashboard - no new visual language. */
function PrevalenceList({ items }: { items: ChhPrevalenceItem[] }) {
  if (items.length === 0 || items.every((i) => i.total === 0)) {
    return (
      <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
        No respondents in this denominator yet.
      </p>
    );
  }
  return (
    <div className="response-list">
      {items.map((item) => (
        <div className="response-item" key={item.label}>
          <div className="response-item-header">
            <span className="response-item-label">{item.label}</span>
            <span className="response-item-value">
              {item.count} ({item.percent}%)
            </span>
          </div>
          <ProportionBar value={item.count} total={item.total} color="var(--series-1)" />
        </div>
      ))}
    </div>
  );
}

/** A field with a genuine third response category (Not applicable /
 * Unsure) - every code keeps its own label and its own bar, never folded
 * into No or Don't-know. */
function ThreeWayList({ breakdown }: { breakdown: ChhThreeWayBreakdown }) {
  if (breakdown.valid_n === 0) {
    return (
      <p className="chart-card-note" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
        No responses recorded yet.
      </p>
    );
  }
  return (
    <div className="response-list">
      {Object.entries(breakdown.counts).map(([label, count]) => (
        <div className="response-item" key={label}>
          <div className="response-item-header">
            <span className="response-item-label">{label}</span>
            <span className="response-item-value">
              {count} ({percentOf(count, breakdown.valid_n)}%)
            </span>
          </div>
          <ProportionBar value={count} total={breakdown.valid_n} color="var(--series-1)" />
        </div>
      ))}
    </div>
  );
}

function NumericSummaryCard({ label, summary, unit = "" }: { label: string; summary: ChhNumericSummary; unit?: string }) {
  const value = summary.mean !== null ? `${summary.mean}${unit}` : "No data";
  const sublabel =
    summary.mean !== null
      ? `median ${summary.median}${unit} · range ${summary.minimum}-${summary.maximum}${unit} · n=${summary.valid_n}/${summary.total} (${summary.percent_valid}%)`
      : `n=0/${summary.total}`;
  return <KpiCard label={label} value={value} sublabel={sublabel} />;
}

function AlertStrip({ alerts }: { alerts: HealthScreeningResponse["chh"]["alerts"] }) {
  const stats: { key: string; label: string; count: number; tone: "good" | "warning" | "critical" | "neutral" }[] = [
    { key: "none", label: "No Concern", count: alerts.no_concern_count, tone: "good" },
    { key: "concern", label: "Assessment Concern", count: alerts.assessment_concern_count, tone: "warning" },
    { key: "deferred", label: "Assessment Deferred", count: alerts.assessment_deferred_count, tone: "critical" },
    { key: "missing", label: "Missing Decision", count: alerts.missing_decision_count, tone: "neutral" },
  ];
  return (
    <div className="chh-alert-strip">
      {stats.map((s) => (
        <div className={`chh-alert-stat chh-alert-stat-${s.tone}`} key={s.key}>
          <div className="chh-alert-stat-value">{s.count}</div>
          <div className="chh-alert-stat-label">{s.label}</div>
          <div className="chh-alert-stat-percent">{alerts.total > 0 ? `${percentOf(s.count, alerts.total)}% of ${alerts.total}` : "No data"}</div>
        </div>
      ))}
    </div>
  );
}

function DataQualityRow({ label, entries }: { label: string; entries: Record<string, number> }) {
  const total = Object.values(entries).reduce((sum, v) => sum + v, 0);
  return (
    <DetailDisclosure summary={`${label} (${total} flagged)`}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(entries).map(([key, count]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DetailDisclosure>
  );
}

export default function HealthScreening() {
  const [data, setData] = useState<HealthScreeningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getHealthScreening()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading Child Health History..." />;

  const { completion, chh } = data;

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Child Health History"
        subtitle="Screening and illness-history instrument - individual indicators and domain-level burden are shown; no single combined clinical health score is calculated."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader title="Overview" note="Assessment-day alert distribution and instrument data quality, at a glance" />
      <div className="chh-section-body">
        <AlertStrip alerts={chh.alerts} />
        <div className="kpi-row">
          <KpiCard
            label="Participants Flagged for Review"
            value={completion.total_registered > 0 ? `${chh.alerts.participants_flagged_for_review}/${completion.total_registered}` : "No data"}
            sublabel="Current illness, neurological history, functional limitation, assessment readiness, performance concern, or rescheduled"
            tone="amber"
          />
          <KpiCard
            label="Completed Forms"
            value={`${chh.data_quality.completed_forms}/${chh.data_quality.total_registered}`}
            sublabel={`${chh.data_quality.partially_completed_forms} partially completed · ${chh.data_quality.not_started_forms} not started`}
          />
        </div>
      </div>

      <SectionHeader
        title="Reported Health Conditions, n (%)"
        note="Percentages use each condition's own valid respondents, not the full registered cohort"
      />
      <div className="chh-section-body">
        <ChartCard title="Reported Health Conditions" subtitle={`Among ${completion.completed} children who completed this instrument`}>
          <CompositionLegend />
          <ConditionCompositionChart items={data.named_conditions} />
        </ChartCard>
        <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
          <DetailTable rows={data.named_conditions} />
        </DetailDisclosure>
      </div>

      <SectionHeader
        title="Reported Health and Medical-History Indicators, n (%)"
        note="Percentages use each indicator's own valid respondents, not the full registered cohort"
      />
      <div className="chh-section-body">
        <ChartCard
          title="Reported Health and Medical-History Indicators"
          subtitle={`Among ${completion.completed} children who completed this instrument`}
        >
          <CompositionLegend />
          <ConditionCompositionChart items={data.general_flags} />
        </ChartCard>
        <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
          <DetailTable rows={data.general_flags} />
        </DetailDisclosure>
      </div>

      {/* --- Section A: Current Health Status --- */}
      <SectionHeader title="Current Health Status" note="Section A - today's symptoms and activity impact" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Current Health Status"
          items={[
            chh.current_health.currently_ill,
            chh.current_health.any_current_symptom,
            chh.current_health.activity_or_school_affected,
          ].map(conditionToPrevalence)}
        />
        <ChartCard title="Number of Current Symptoms" subtitle="Among children who answered the symptom checklist">
          <CategoryBarChart
            data={chh.current_health.symptom_count_distribution.map((c) => ({ label: c.code, count: c.count }))}
            mode="sequential"
            height={170}
          />
        </ChartCard>
        <ChartCard title="Symptom Prevalence" subtitle="Selected ÷ children who answered the symptom checklist">
          <PrevalenceList items={chh.current_health.symptom_prevalence} />
        </ChartCard>
      </div>

      {/* --- Section B: Recent History of Illness --- */}
      <SectionHeader title="Recent History of Illness" note="Section B - past 3 months" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Recent History of Illness"
          items={[conditionToPrevalence(chh.recent_illness.consultation_required), chh.recent_illness.recurrent_illness]}
        />
        <div className="kpi-row chh-highlight-row">
          <NumericSummaryCard label="School Days Missed" summary={chh.recent_illness.school_days_missed_summary} unit=" days" />
        </div>
        <div className="chart-grid two-col">
          <ChartCard title="Illness Frequency (3 months)" subtitle="Ordered by category">
            <CategoryBarChart
              data={chh.recent_illness.illness_frequency_distribution.map((c) => ({ label: c.code, count: c.count }))}
              mode="sequential"
              height={190}
            />
          </ChartCard>
          <ChartCard title="Missed School Due to Illness" subtitle="No / Yes / Not applicable, kept distinct">
            <ThreeWayList breakdown={chh.recent_illness.missed_school} />
          </ChartCard>
        </div>
      </div>

      {/* --- Section C: Major or Chronic Illness --- */}
      <SectionHeader title="Major or Chronic Illness" note="Section C - condition prevalence shown above; composite indicator below" />
      <div className="chh-section-body">
        <IndicatorGroup title="Major or Chronic Illness" items={[conditionToPrevalence(chh.chronic_illness.diagnosed_condition)]} />
        <div className="kpi-row chh-highlight-row">
          <CompositeKpi indicator={chh.chronic_illness.any_listed_condition} tone="amber" />
        </div>
        <ChartCard title="Number of Chronic Conditions" subtitle="Among children who answered at least one condition">
          <CategoryBarChart
            data={chh.chronic_illness.condition_count_distribution.map((c) => ({ label: c.code, count: c.count }))}
            mode="sequential"
            height={170}
          />
        </ChartCard>
      </div>

      {/* --- Section D: Neurological History --- */}
      <SectionHeader title="Neurological History" note="Section D" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Neurological History"
          items={[
            chh.neurological.seizure_history,
            chh.neurological.fainting_history,
            chh.neurological.cns_infection_history,
            chh.neurological.head_injury_history,
          ]
            .map(conditionToPrevalence)
            .concat([chh.neurological.treated_head_injury])}
        />
        <div className="kpi-row chh-highlight-row">
          <CompositeKpi indicator={chh.neurological.any_neurological_history} tone="amber" />
        </div>
        <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
          <DetailTable
            rows={[
              chh.neurological.seizure_history,
              chh.neurological.fainting_history,
              chh.neurological.cns_infection_history,
              chh.neurological.head_injury_history,
            ]}
          />
        </DetailDisclosure>
        <ChartCard title="Neurological Concern Count" subtitle="Number of neurological-history items marked Yes, per child">
          <CategoryBarChart
            data={chh.neurological.concern_count_distribution.map((c) => ({ label: c.code, count: c.count }))}
            mode="sequential"
            height={170}
          />
        </ChartCard>
      </div>

      {/* --- Section E: Vision and Hearing --- */}
      <SectionHeader title="Vision and Hearing" note="Section E" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Vision and Hearing"
          items={[
            chh.sensory.vision_difficulty,
            chh.sensory.uses_glasses,
            chh.sensory.hearing_difficulty,
            chh.sensory.recurrent_ear_infection,
          ].map(conditionToPrevalence)}
        />
        <div className="kpi-row chh-highlight-row">
          <CompositeKpi indicator={chh.sensory.any_sensory_concern} tone="amber" />
          <CompositeKpi indicator={chh.sensory.any_vision_indicator} tone="blue" />
        </div>
        <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
          <DetailTable
            rows={[
              chh.sensory.vision_difficulty,
              chh.sensory.uses_glasses,
              chh.sensory.hearing_difficulty,
              chh.sensory.recurrent_ear_infection,
            ]}
          />
        </DetailDisclosure>
      </div>

      {/* --- Section F: Developmental and Learning History --- */}
      <SectionHeader title="Developmental and Learning History" note="Section F" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Developmental and Learning History"
          items={[
            conditionToPrevalence(chh.developmental.any_developmental_concern),
            conditionToPrevalence(chh.developmental.diagnosed_condition),
            chh.developmental.concern_without_diagnosis,
          ]}
        />
        <div className="chart-grid two-col">
          <ChartCard title="Developmental Domains Affected" subtitle="Number of domains selected, per child">
            <CategoryBarChart
              data={chh.developmental.domain_count_distribution.map((c) => ({ label: c.code, count: c.count }))}
              mode="sequential"
              height={190}
            />
          </ChartCard>
          <ChartCard title="Domain Prevalence" subtitle="Selected ÷ children who answered the developmental checklist">
            <PrevalenceList items={chh.developmental.domain_prevalence} />
          </ChartCard>
        </div>
      </div>

      {/* --- Section G: Hospitalisation, Treatment and Allergy --- */}
      <SectionHeader title="Hospitalisation, Treatment and Allergy" note="Section G" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Hospitalisation, Treatment and Allergy"
          items={[
            chh.hospitalisation.ever_hospitalised,
            chh.hospitalisation.surgery_or_procedure,
            chh.hospitalisation.regular_medication,
            chh.hospitalisation.known_allergy,
          ]
            .map(conditionToPrevalence)
            .concat([chh.hospitalisation.recurrent_hospitalisation])}
        />
        <div className="kpi-row chh-highlight-row">
          <CompositeKpi indicator={chh.hospitalisation.major_treatment_history} tone="amber" />
          <NumericSummaryCard label="Hospitalisation Count" summary={chh.hospitalisation.hospitalisation_count_summary} unit=" times" />
        </div>
        <DetailDisclosure summary="Show exact values (Yes / No / Don't know / Valid N)">
          <DetailTable
            rows={[
              chh.hospitalisation.ever_hospitalised,
              chh.hospitalisation.surgery_or_procedure,
              chh.hospitalisation.regular_medication,
              chh.hospitalisation.known_allergy,
            ]}
          />
        </DetailDisclosure>
        <ChartCard title="Allergy Type" subtitle="Among children with a known allergy">
          <PrevalenceList items={chh.hospitalisation.allergy_type_prevalence} />
        </ChartCard>
      </div>

      {/* --- Section H: Functional Health Status --- */}
      <SectionHeader title="Functional Health Status" note="Section H" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Functional Health Status"
          items={[
            conditionToPrevalence(chh.functional_health.any_functional_limitation),
            chh.functional_health.suboptimal_health,
            chh.functional_health.poor_health,
          ]}
        />
        <div className="chart-grid two-col">
          <ChartCard title="Overall Perceived Health" subtitle="Compared with other children of the same age">
            <CategoryBarChart
              data={chh.functional_health.overall_health_distribution.map((c) => ({ label: c.code, count: c.count }))}
              mode="sequential"
              height={190}
            />
          </ChartCard>
          <ChartCard title="Function-Specific Limitation" subtitle="Selected ÷ children who answered the functional-limitation checklist">
            <PrevalenceList items={chh.functional_health.function_prevalence} />
          </ChartCard>
        </div>
      </div>

      {/* --- Section I: Assessment-Day Health Status --- */}
      <SectionHeader title="Assessment Readiness" note="Section I - health status on the day of assessment" />
      <div className="chh-section-body">
        <IndicatorGroup
          title="Assessment Readiness"
          items={[
            conditionToPrevalence(chh.assessment_day.condition_affecting_performance),
            {
              label: "Any Assessment-Day Concern",
              count: chh.assessment_day.any_assessment_day_concern_count,
              total: chh.assessment_day.any_assessment_day_concern_total,
              percent: chh.assessment_day.any_assessment_day_concern_percent,
            },
          ]}
        />
        <div className="chart-grid two-col">
          <ChartCard title="Well Enough for Assessment" subtitle="Yes / No / Unsure, kept distinct">
            <ThreeWayList breakdown={chh.assessment_day.well_for_assessment} />
          </ChartCard>
          <ChartCard title="Assessment Decision" subtitle="Assessor's own recorded options only">
            <PrevalenceList
              items={chh.assessment_day.assessment_decision_distribution.map((c) => ({
                label: c.code,
                count: c.count,
                total: chh.assessment_day.assessment_decision_distribution.reduce((s, x) => s + x.count, 0),
                percent: percentOf(c.count, chh.assessment_day.assessment_decision_distribution.reduce((s, x) => s + x.count, 0)),
              }))}
            />
          </ChartCard>
        </div>
        <ChartCard title="Performance-Affecting Conditions" subtitle="Among children with a condition that may affect performance">
          <PrevalenceList items={chh.assessment_day.performance_condition_prevalence} />
        </ChartCard>
      </div>

      {/* --- Section 13: Data Quality --- */}
      <SectionHeader title="Data Quality" note="Instrument-level validation and completeness checks" />
      <div className="chh-section-body">
        <div className="table-card">
          <DataQualityRow label="Checkbox 'None' selected with another option" entries={chh.data_quality.checkbox_none_conflicts} />
          <DataQualityRow label="Yes response missing required specification" entries={chh.data_quality.yes_missing_specification} />
          <DataQualityRow label="Branched field completed despite No" entries={chh.data_quality.branched_field_when_parent_no} />
          <DataQualityRow label="Don't know / unknown responses by section" entries={chh.data_quality.dont_know_or_unknown_by_section} />
          <DataQualityRow label="Invalid or negative numeric entries" entries={chh.data_quality.negative_numeric_entries} />
        </div>
        <div className="kpi-row">
          <KpiCard
            label="Health Concern, Decision Missing"
            value={chh.data_quality.health_concern_decision_missing}
            sublabel="Assessment-day concern recorded but no assessor decision"
            tone="neutral"
          />
          <KpiCard
            label="Duplicate Child ID Records"
            value={chh.data_quality.duplicate_child_id_records}
            sublabel="Registered dataset-wide check, not specific to this instrument"
            tone="neutral"
          />
        </div>
      </div>
    </section>
  );
}
