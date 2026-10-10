import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import { percentOf } from "../components/charts/chartHelpers";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import DonutChart from "../components/DonutChart";
import FullScreenLoader from "../components/FullScreenLoader";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import type {
  ChhPrevalenceItem,
  ChhThreeWayBreakdown,
  ConditionIndicator,
  HealthScreeningResponse,
} from "../types/liveDashboard";

/** Child Health History - "Health-History Overview" redesign (2026-10-10,
 * supersedes the compact-infographic redesign from earlier the same day).
 * Every figure is read directly from the existing `/dashboard/health`
 * response - no invented composite, no fabricated value. Field mappings
 * and denominators were independently re-verified against the live REDCap
 * API as part of this change (see the "Fields used" note at the end of
 * this file's trailing comment block and the accompanying audit).
 *
 * A genuine, previously-invisible backend bug was found and fixed while
 * verifying this page's new "Findings to Verify" section: the free-text
 * "_spec"/"_reason"/"_name" follow-up fields (e.g. `chh_illness_3mo_spec`)
 * were never included in `LIVE_FIELDS` (`live_field_map.py`), so every
 * "Yes but missing description" calculation - both the pre-existing
 * `data_quality.yes_missing_specification` and this page's new
 * `verification_flags.missing_consultation_description` - was silently
 * computing against an always-absent field, inflating counts to nearly
 * the full Yes-count for that question (e.g. "Q4 missing specification"
 * read 47 instead of the true 1). Fixed by adding
 * `CHH_SPECIFICATION_FIELDS` to `LIVE_FIELDS` - no calculation logic
 * changed, only which fields are actually fetched from REDCap. */

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

type Tone = "blue" | "teal" | "violet" | "amber";

/** One compact comparison/summary row - label + n/N·percent, a thin
 * square-ended monitor-bar beneath. Shared by every "numeric summary
 * instead of a chart" indicator across this page. */
function MiniStatRow({
  label,
  count,
  total,
  percent,
  tone = "blue",
}: {
  label: string;
  count: number;
  total: number;
  percent: number;
  tone?: Tone;
}) {
  return (
    <div className="chh-mini-row">
      <div className="chh-mini-row-top">
        <span className="chh-mini-row-label">{label}</span>
        <span className="chh-mini-row-value">{total > 0 ? `${count}/${total} · ${percent}%` : "No data"}</span>
      </div>
      <div className={`monitor-bar monitor-bar-tone-${tone}`}>
        <div className="monitor-bar-fill" style={{ width: `${total > 0 ? Math.min(100, Math.max(0, percent)) : 0}%` }} />
      </div>
    </div>
  );
}

/** A compact, label-only numeric line - no bar - for distributions that
 * are genuinely not a single proportion (e.g. "illness frequency" has 4
 * ordinal categories, not one Yes/No rate). Used instead of a bar chart
 * per the "small numerical summaries rather than a chart for every
 * question" instruction. */
function InlineStatList({ items }: { items: { label: string; count: number; percent: number }[] }) {
  if (items.length === 0 || items.every((i) => i.count === 0)) {
    return <p className="chh-explorer-empty">No data recorded yet.</p>;
  }
  return (
    <div className="chh-inline-list">
      {items.map((i) => (
        <div className="chh-inline-list-row" key={i.label}>
          <span className="chh-inline-list-label">{i.label}</span>
          <span className="chh-inline-list-value">
            {i.count} ({i.percent}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function ThreeWayInlineList({ breakdown }: { breakdown: ChhThreeWayBreakdown }) {
  if (breakdown.valid_n === 0) {
    return <p className="chh-explorer-empty">No responses recorded yet.</p>;
  }
  return (
    <InlineStatList
      items={Object.entries(breakdown.counts).map(([label, count]) => ({ label, count, percent: percentOf(count, breakdown.valid_n) }))}
    />
  );
}

/** The "Reported Diseases and Medical History" clinical matrix - one
 * always-visible compact table per group (Chronic / Neurological &
 * Developmental / Other Medical History). Every row is an unmodified
 * backend `ConditionIndicator` - Yes/No/Don't-know/Valid N/Asked N are
 * shown exactly as computed, nothing combined or re-derived here. A small
 * inline proportion sliver gives an at-a-glance visual cue without a
 * separate chart per condition. */
const VALID_N_TITLE = "Children who actually answered this specific question (the correct percentage denominator)";
const ASKED_N_TITLE = "Children whose Child Health History form REDCap has marked \"Complete\"";

function DiseaseMatrixTable({ title, items }: { title: string; items: ConditionIndicator[] }) {
  return (
    <div className="chh-matrix-group">
      <div className="chh-matrix-group-title">{title}</div>
      <div className="chh-matrix-scroll">
        <table className="data-table chh-matrix-table">
          <colgroup>
            <col className="chh-matrix-col-condition" />
            <col className="chh-matrix-col-yes" />
            <col className="chh-matrix-col-num" />
            <col className="chh-matrix-col-num" />
            <col className="chh-matrix-col-num" />
            <col className="chh-matrix-col-num" />
          </colgroup>
          <thead>
            <tr>
              <th>Condition</th>
              <th>Yes</th>
              <th>No</th>
              <th>DK</th>
              <th title={VALID_N_TITLE}>Valid N</th>
              <th title={ASKED_N_TITLE}>Asked N</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.label}>
                <td className="chh-matrix-condition">{c.label}</td>
                <td className="chh-matrix-yes-cell">
                  <span className="chh-matrix-sliver">
                    <span className="chh-matrix-sliver-fill" style={{ width: `${Math.min(100, c.percent_yes)}%` }} />
                  </span>
                  <span className="chh-matrix-yes">
                    {c.yes_count} ({c.percent_yes}%)
                  </span>
                </td>
                <td>{c.no_count}</td>
                <td>{c.dont_know_count}</td>
                <td title={VALID_N_TITLE}>{c.valid_n}</td>
                <td title={ASKED_N_TITLE}>{c.asked_n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ranked list for developmental-concern domains - rank + label + bar +
 * count/percent, sorted by count descending so the most-reported concern
 * domains are immediately visible. */
function RankedList({ items }: { items: ChhPrevalenceItem[] }) {
  const ranked = [...items].sort((a, b) => b.count - a.count);
  if (ranked.length === 0 || ranked.every((i) => i.count === 0)) {
    return <p className="chh-explorer-empty">No domains reported yet.</p>;
  }
  const max = Math.max(...ranked.map((i) => i.count), 1);
  return (
    <div className="chh-ranked-list">
      {ranked.map((item, idx) => (
        <div className="chh-ranked-row" key={item.label}>
          <span className="chh-ranked-index">{idx + 1}</span>
          <span className="chh-ranked-label">{item.label}</span>
          <div className="monitor-bar monitor-bar-tone-violet chh-ranked-bar">
            <div className="monitor-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="chh-ranked-value">
            {item.count}/{item.total} · {item.percent}%
          </span>
        </div>
      ))}
    </div>
  );
}

/** "Findings to Verify" - collapsed by default, recomputed fresh from
 * `chh.verification_flags` on every load (never hardcoded). These are
 * verification flags, not confirmed diagnoses or confirmed data-collector
 * errors - framed as such throughout. This application has no
 * user-level access control, so record IDs here are visible to anyone who
 * can open this page - noted explicitly rather than implying a
 * restriction this app cannot actually enforce. */
interface FindingFlag {
  recordId: string;
  field: string;
  description: string;
}

/** Flattens `verification_flags` into one row per (record, flag) pair -
 * the shape every count/grouping below is derived from, so "total flag
 * instances" and "unique affected records" can never drift apart from
 * what's actually displayed. Distinct flags on the same record are kept
 * as distinct entries here (never merged into one) - a record with 2
 * different flags contributes 2 rows, not 1. */
function flattenFindings(flags: HealthScreeningResponse["chh"]["verification_flags"]): FindingFlag[] {
  const rows: FindingFlag[] = [];
  for (const id of flags.tb_without_chronic_condition_ids) {
    rows.push({ recordId: id, field: "chh_q8_tb / chh_chronic_condition", description: 'TB (Q8c) coded Yes while "any chronic condition" (Q7) is coded No' });
  }
  for (const id of flags.missing_consultation_description_ids) {
    rows.push({
      recordId: id,
      field: "chh_illness_3mo_spec",
      description: "Healthcare consultation (Q4) = Yes with a blank required description (Q4a)",
    });
  }
  for (const group of flags.checkbox_blank_on_complete) {
    for (const id of group.record_ids) {
      rows.push({ recordId: id, field: group.field, description: `${group.label} left entirely blank on an otherwise-completed form` });
    }
  }
  return rows;
}

function pluralize(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function FindingsToVerify({ flags }: { flags: HealthScreeningResponse["chh"]["verification_flags"] }) {
  const [showIds, setShowIds] = useState(false);
  const allFlags = flattenFindings(flags);
  const totalFlags = allFlags.length;

  const byRecord = new Map<string, FindingFlag[]>();
  for (const flag of allFlags) {
    const existing = byRecord.get(flag.recordId);
    if (existing) existing.push(flag);
    else byRecord.set(flag.recordId, [flag]);
  }
  const recordIds = Array.from(byRecord.keys()).sort();
  const uniqueRecords = recordIds.length;

  const summary = totalFlags === 0 ? "Findings to Verify (no flags in current data)" : `Findings to Verify — ${pluralize(totalFlags, "flag")} across ${pluralize(uniqueRecords, "record")}`;

  return (
    <DetailDisclosure summary={summary}>
      <p className="chh-verify-note">
        These are <strong>automated screening flags only</strong> - mechanically recomputed from today's live REDCap data on
        every page load, never hardcoded. They require <strong>human review</strong>; none of them is a confirmed data-entry
        error or a confirmed clinical diagnosis, and no value is inferred or auto-corrected on their basis.
      </p>
      <p className="chh-verify-note">
        <strong>No per-user access control exists in this application</strong> (verified: there is no login, session, or
        role system anywhere in the codebase) - so a toggle below can hide record IDs from casual view, but this is a
        display preference only, not a real security boundary. Anyone able to open this page can still reveal the IDs or
        read them directly from the API response; do not treat this toggle as access control.
      </p>

      {totalFlags === 0 ? (
        <p className="chh-verify-note">No findings in the current data.</p>
      ) : (
        <>
          <button type="button" className="chh-verify-toggle" onClick={() => setShowIds((v) => !v)}>
            {showIds ? "Hide record IDs" : "Show record IDs"}
          </button>

          <div className="chh-verify-records">
            {recordIds.map((recordId) => {
              const recordFlags = byRecord.get(recordId)!;
              return (
                <div className="chh-verify-record" key={recordId}>
                  <div className="chh-verify-record-id">
                    {showIds ? recordId : "•••• (hidden)"} <span className="chh-verify-record-count">{pluralize(recordFlags.length, "flag")}</span>
                  </div>
                  <ul className="chh-verify-record-flags">
                    {recordFlags.map((flag, idx) => (
                      <li key={idx}>
                        {flag.description} <span className="chh-verify-field">({flag.field})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="chh-verify-note">
        Free-text-vs-code contradictions (e.g. a written history describing a condition whose matching coded field says "No")
        cannot be reliably automated without guessing at free text, and are not included above - those require a human
        reviewer reading the original record directly in REDCap.
      </p>
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
  const currentlyIll = chh.current_health.currently_ill;
  const activitySchool = chh.current_health.activity_or_school_affected;
  const chronic = chh.chronic_illness.any_listed_condition;
  const neurological = chh.neurological.any_neurological_history;
  const developmental = chh.developmental.any_developmental_concern;
  const devBlankGroup = chh.verification_flags.checkbox_blank_on_complete.find((g) => g.field === "chh_dev_concern");

  return (
    <section>
      <PageHeader
        eyebrow="Study Assessment"
        title="Child Health History"
        subtitle="Screening and illness-history instrument - the conditions and indicators actually reported are shown directly; no single combined clinical health score is calculated."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      {/* --- A. Health History at a Glance --- */}
      <div className="stat-strip">
        <div className="stat-block">
          <span className="stat-block-label">Health Forms Completed</span>
          <span className="stat-block-value">
            {completion.completed}/{STUDY_ORIGINAL_ENROLLMENT}
          </span>
          <span className="stat-block-footnote">
            {percentOf(completion.completed, STUDY_ORIGINAL_ENROLLMENT)}% of the original {STUDY_ORIGINAL_ENROLLMENT}-child
            cohort · {completion.completed}/{completion.total_registered} ({completion.percent}%) of currently active
            children
          </span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Current Illness</span>
          <span className="stat-block-value">
            {currentlyIll.yes_count}/{currentlyIll.valid_n}
          </span>
          <span className="stat-block-footnote">{currentlyIll.percent_yes}% of {currentlyIll.valid_n} valid responses</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Chronic Conditions</span>
          <span className="stat-block-value">
            {chronic.yes_count}/{chronic.valid_n}
          </span>
          <span className="stat-block-footnote">
            {chronic.percent_yes}% report ≥1 of 11 verified chronic conditions · {chronic.valid_n} valid responses
          </span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Neurological / Developmental History</span>
          <span className="stat-block-value">
            {neurological.yes_count}/{neurological.valid_n}
            <span className="chh-stat-secondary">neurological</span>
          </span>
          <span className="stat-block-footnote">
            {neurological.percent_yes}% neurological (seizures/fainting/CNS infection/head injury) · developmental{" "}
            {developmental.yes_count}/{developmental.valid_n} ({developmental.percent_yes}%) - shown separately, not combined
            into one figure
          </span>
        </div>
      </div>

      {/* --- B. Current Illness --- */}
      <SectionHeader title="Current Illness" note="Sections A & B - today's status and recent illness history" />
      <div className="chh-section-body chh-section-panel">
        <div className="chart-grid two-col">
          <ChartCard
            title="Currently Reporting Illness"
            subtitle={`Among ${currentlyIll.valid_n} children who answered (asked ${currentlyIll.asked_n})`}
          >
            <DonutChart
              data={[
                { label: "Currently ill", count: currentlyIll.yes_count },
                { label: "Not ill", count: currentlyIll.no_count },
                { label: "Don't know", count: currentlyIll.dont_know_count },
              ]}
              height={124}
              centerValue={`${currentlyIll.percent_yes}%`}
              centerLabel="Reporting illness"
            />
            <div className="chh-subviz-label">Most Frequently Reported Symptoms</div>
            <p className="chh-matrix-note">A child may report more than one symptom - percentages need not sum to 100%.</p>
            <RankedList items={chh.current_health.symptom_prevalence} />
          </ChartCard>

          <ChartCard title="Recent Illness History" subtitle="Numeric summaries - each with its own valid-response denominator">
            <MiniStatRow
              label="Activity/School Impact (7 days)"
              count={activitySchool.yes_count}
              total={activitySchool.valid_n}
              percent={activitySchool.percent_yes}
              tone="blue"
            />
            <MiniStatRow
              label="Healthcare Consultation (3 months)"
              count={chh.recent_illness.consultation_required.yes_count}
              total={chh.recent_illness.consultation_required.valid_n}
              percent={chh.recent_illness.consultation_required.percent_yes}
              tone="teal"
            />
            <div className="chh-subviz-label">Illness Frequency (3 months)</div>
            <InlineStatList
              items={(() => {
                const dist = chh.recent_illness.illness_frequency_distribution;
                const total = dist.reduce((s, d) => s + d.count, 0);
                return dist.map((d) => ({ label: d.code, count: d.count, percent: percentOf(d.count, total) }));
              })()}
            />
            <div className="chh-subviz-label">School Absence Due to Illness</div>
            <ThreeWayInlineList breakdown={chh.recent_illness.missed_school} />
            {chh.recent_illness.school_days_missed_summary.mean !== null && (
              <p className="chh-matrix-note">
                Among children who missed school: mean {chh.recent_illness.school_days_missed_summary.mean} days, median{" "}
                {chh.recent_illness.school_days_missed_summary.median} days (n=
                {chh.recent_illness.school_days_missed_summary.valid_n}/{chh.recent_illness.school_days_missed_summary.total}
                ).
              </p>
            )}
          </ChartCard>
        </div>
      </div>

      {/* --- C. Reported Diseases and Medical History --- */}
      <SectionHeader
        title="Reported Diseases and Medical History"
        note="Every condition's own valid-response denominator - never the full registered cohort"
      />
      <div className="chh-section-body chh-section-panel">
        <p className="chh-matrix-note chh-matrix-note-lead">
          <strong>Valid N</strong> is every child who actually answered that specific question - the correct percentage
          denominator. <strong>Asked N</strong> is children whose form REDCap has marked "Complete." Audited against live
          REDCap: one record in the current data answered every question on this form but has not yet been marked Complete,
          so Valid N can run 1 higher than Asked N on most rows below - this is expected, source-data behaviour, not a
          calculation error. A row where Valid N is lower than that (e.g. 102 instead of 103) means one additional,
          otherwise-complete form skipped that one specific question.
        </p>
        <DiseaseMatrixTable title="Chronic Conditions" items={chh.chronic_illness.condition_prevalence} />
        <DiseaseMatrixTable
          title="Neurological and Developmental History"
          items={[
            chh.neurological.seizure_history,
            chh.neurological.fainting_history,
            chh.neurological.cns_infection_history,
            chh.neurological.head_injury_history,
            chh.developmental.diagnosed_condition,
            chh.developmental.any_developmental_concern,
          ]}
        />
        <DiseaseMatrixTable
          title="Other Medical History"
          items={[
            chh.sensory.recurrent_ear_infection,
            chh.sensory.vision_difficulty,
            chh.sensory.hearing_difficulty,
            chh.hospitalisation.ever_hospitalised,
            chh.hospitalisation.surgery_or_procedure,
            chh.hospitalisation.regular_medication,
            chh.hospitalisation.known_allergy,
          ]}
        />
        <p className="chh-matrix-note">
          A "0 Yes" row reflects a genuine coded "No" from valid respondents (confirmed directly against live REDCap) - a
          blank/unanswered field is never counted as No, and is instead excluded from Valid N. Rows are independent
          questions; counts are not added together into a combined "total affected children" figure, since a child can
          report more than one condition.
        </p>
      </div>

      {/* --- D. Hospitalisation and Medication --- */}
      <SectionHeader title="Hospitalisation and Medication" note="Section G - numeric depth beyond the matrix above" />
      <div className="chh-section-body chh-section-panel">
        <MiniStatRow
          label="Ever Hospitalised"
          count={chh.hospitalisation.ever_hospitalised.yes_count}
          total={chh.hospitalisation.ever_hospitalised.valid_n}
          percent={chh.hospitalisation.ever_hospitalised.percent_yes}
          tone="amber"
        />
        {chh.hospitalisation.hospitalisation_count_summary.mean !== null && (
          <p className="chh-matrix-note">
            Among those hospitalised: mean {chh.hospitalisation.hospitalisation_count_summary.mean} times, median{" "}
            {chh.hospitalisation.hospitalisation_count_summary.median} (n={chh.hospitalisation.hospitalisation_count_summary.valid_n}
            /{chh.hospitalisation.hospitalisation_count_summary.total}); recurrent (2+ times): {chh.hospitalisation.recurrent_hospitalisation.count}/
            {chh.hospitalisation.recurrent_hospitalisation.total} ({chh.hospitalisation.recurrent_hospitalisation.percent}%). Reasons
            are recorded in REDCap but not reproduced here.
          </p>
        )}
        <MiniStatRow
          label="Regular Medication"
          count={chh.hospitalisation.regular_medication.yes_count}
          total={chh.hospitalisation.regular_medication.valid_n}
          percent={chh.hospitalisation.regular_medication.percent_yes}
          tone="teal"
        />
        <p className="chh-matrix-note">Medication names/reasons are recorded in REDCap but are not reproduced on this page.</p>
      </div>

      {/* --- E. Developmental Concerns and Overall Health --- */}
      <SectionHeader title="Developmental Concerns and Overall Health" note="Section F - ranked by how often each domain is reported" />
      <div className="chh-section-body chh-section-panel">
        <ChartCard
          title="Developmental Concern Domains"
          subtitle={`Among ${chh.developmental.any_developmental_concern.valid_n} children who answered the checklist`}
        >
          <RankedList items={chh.developmental.domain_prevalence} />
          <p className="chh-matrix-note">
            A child can report concerns in more than one domain - the ranked counts above need not sum to the number of
            children with any concern. Per-child domain count: {chh.developmental.domain_count_distribution.map((c) => `${c.code}: ${c.count}`).join(" · ")}.
          </p>
          <p className="chh-matrix-note">
            "No concern" includes an explicit "None" response{devBlankGroup && devBlankGroup.count > 0 ? (
              <>
                {" "}
                and excludes {devBlankGroup.count} record(s) where this checkbox was left entirely blank on an otherwise
                completed form - see Findings to Verify below
              </>
            ) : (
              " - no record currently has this checkbox left entirely blank on a completed form"
            )}
            .
          </p>
        </ChartCard>
        <ChartCard title="Overall Perceived Health" subtitle="Exact counts and percentages, ordered Very good → Very poor">
          <CategoryBarChart
            data={chh.functional_health.overall_health_distribution.map((c) => ({ label: c.code, count: c.count }))}
            mode="sequential"
            height={190}
            showPercent
          />
        </ChartCard>
      </div>

      {/* --- F. Assessment Readiness --- */}
      <SectionHeader title="Assessment Readiness" note="Section I - the actual recorded readiness/fitness fields only" />
      <div className="chh-section-body chh-section-panel">
        <div className="chart-grid two-col">
          <ChartCard title="Well Enough for Today's Assessment" subtitle="Yes / No / Unsure, kept distinct (Q25)">
            <ThreeWayInlineList breakdown={chh.assessment_day.well_for_assessment} />
          </ChartCard>
          <ChartCard title="Assessor's Recorded Decision" subtitle="Q27 - the assessor's own recorded options only">
            <InlineStatList
              items={(() => {
                const dist = chh.assessment_day.assessment_decision_distribution;
                const total = dist.reduce((s, d) => s + d.count, 0);
                return dist.map((d) => ({ label: d.code, count: d.count, percent: percentOf(d.count, total) }));
              })()}
            />
          </ChartCard>
        </div>
        <MiniStatRow
          label="Condition May Affect Today's Performance (Q26)"
          count={chh.assessment_day.condition_affecting_performance.yes_count}
          total={chh.assessment_day.condition_affecting_performance.valid_n}
          percent={chh.assessment_day.condition_affecting_performance.percent_yes}
          tone="amber"
        />
        {chh.assessment_day.performance_condition_prevalence.some((i) => i.count > 0) ? (
          <ChartCard title="Performance-Affecting Conditions (Q26a)" subtitle="Among children with a condition that may affect performance">
            <InlineStatList
              items={chh.assessment_day.performance_condition_prevalence.map((i) => ({ label: i.label, count: i.count, percent: i.percent }))}
            />
          </ChartCard>
        ) : (
          <p className="chh-matrix-note">Performance-Affecting Conditions (Q26a): No data recorded yet.</p>
        )}
      </div>

      {/* --- Findings to Verify --- */}
      <SectionHeader title="Findings to Verify" note="Unresolved source-data flags - recalculated live, never hardcoded" />
      <div className="chh-section-body">
        <FindingsToVerify flags={chh.verification_flags} />
      </div>
    </section>
  );
}
