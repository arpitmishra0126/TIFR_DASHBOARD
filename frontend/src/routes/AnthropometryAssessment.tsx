import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";

import { getAnthropometry } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DonutChart from "../components/DonutChart";
import FullScreenLoader from "../components/FullScreenLoader";
import { IconActivity, IconCalendar, IconChart, IconChevron, IconClipboardAlert, IconFlag, IconHeart, IconUsers } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type {
  AnthropometryChildRow,
  AnthropometryClassificationCard,
  AnthropometryResponse,
  MeasurementSummary,
} from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

// Flat color tokens (not the shared KpiCard tone system) reused for the
// Growth Screening cards, which need a 5th distinct tone - all resolve
// through existing design tokens, no new colors introduced.
const CLASSIFICATION_TONE: Record<string, string> = {
  short_stature: "blue",
  low_weight: "violet",
  thinness: "amber",
  overweight: "green",
  obesity: "red",
};

const CLASSIFICATION_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  short_stature: IconUsers,
  low_weight: IconActivity,
  thinness: IconChart,
  overweight: IconHeart,
  obesity: IconClipboardAlert,
};

// Maps a classification card's key to the literal flagged value its three
// table columns (height/weight/bmi_screening) use - so clicking a card can
// filter the review table to exactly the children it counts, reusing the
// existing filter state rather than a second filtering mechanism.
const KEY_TO_FLAGGED_VALUE: Record<string, string> = {
  short_stature: "Short stature",
  low_weight: "Low weight-for-age",
  thinness: "Thinness",
  overweight: "Overweight",
  obesity: "Obesity",
};

type MeasurementKey = "height" | "weight" | "bmi" | "muac" | "head_circumference" | "waist_circumference" | "hip_circumference";

const MEASUREMENT_FIELDS: { key: MeasurementKey; label: string; unit: string }[] = [
  { key: "height", label: "Height", unit: "cm" },
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "bmi", label: "BMI", unit: "kg/m²" },
  { key: "muac", label: "MUAC", unit: "cm" },
  { key: "head_circumference", label: "Head Circumference", unit: "cm" },
  { key: "waist_circumference", label: "Waist Circumference", unit: "cm" },
  { key: "hip_circumference", label: "Hip Circumference", unit: "cm" },
];

function fmt(n: number | null, digits = 1): string {
  return n === null ? "—" : n.toFixed(digits);
}

function percentOf(count: number, total: number): number | null {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : null;
}

function ageGroupOf(age: number | null): string {
  if (age === null) return "Unknown";
  if (age === 8 || age === 9 || age === 10) return `${age} years`;
  return "Other";
}

// Backend histogram bin labels are a precise "X.X–Y.Y" range (e.g.
// "114.0–119.4") - display-only rounding to whole numbers here keeps every
// tick short enough to render on one line (never wrapping mid-number); the
// underlying bin boundaries/counts returned by the API are unchanged.
function formatHistogramBinLabel(code: string): string {
  const parts = code.split("–");
  if (parts.length === 2) {
    const lo = Number(parts[0]);
    const hi = Number(parts[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return `${Math.round(lo)}–${Math.round(hi)}`;
    }
  }
  const single = Number(code);
  return Number.isFinite(single) ? `${Math.round(single)}` : code;
}

function screeningCellClass(value: string): string {
  if (value === "Not available") return "anthro-screening-na";
  if (value === "Normal") return "";
  return "anthro-screening-flag";
}

// Splits a classification label like "Short Stature (Height-for-Age)" into
// a main line and a parenthetical sub-line for the two-line screening card
// header - derived from the one backend label string, not duplicated.
function splitClassificationLabel(label: string): [string, string] {
  const idx = label.indexOf(" (");
  if (idx === -1) return [label, ""];
  return [label.slice(0, idx), label.slice(idx + 1)];
}

function MeasurementDetail({ field, summary }: { field: { key: MeasurementKey; label: string; unit: string }; summary: MeasurementSummary }) {
  const histogram = summary.histogram.map((c) => ({ label: formatHistogramBinLabel(c.code), count: c.count }));
  return (
    <ChartCard title={`${field.label} (${field.unit})`} subtitle={`n=${summary.valid_n}/${summary.total} valid (${summary.percent_valid}%)`}>
      <div className="anthro-measurement-stats">
        <div className="anthro-measurement-stat">
          <span className="anthro-measurement-stat-label">Median (IQR)</span>
          <span className="anthro-measurement-stat-value anthro-measurement-stat-value-primary">
            {fmt(summary.median)}
            {summary.q1 !== null && summary.q3 !== null ? ` (${fmt(summary.q1)}–${fmt(summary.q3)})` : ""}
          </span>
        </div>
        <div className="anthro-measurement-stat anthro-measurement-stat-secondary">
          <span className="anthro-measurement-stat-label">Mean &plusmn; SD</span>
          <span className="anthro-measurement-stat-value">
            {fmt(summary.mean)}
            {summary.std_dev !== null ? ` ± ${fmt(summary.std_dev)}` : ""}
          </span>
        </div>
      </div>
      {histogram.length > 0 ? (
        <CategoryBarChart data={histogram} mode="sequential" height={220} xTickMaxChars={10} yAxisLabel="Children" />
      ) : (
        <p className="chart-card-note">No valid measurements recorded yet.</p>
      )}
    </ChartCard>
  );
}

function ScreeningCard({
  card,
  onSelect,
}: {
  card: AnthropometryClassificationCard;
  onSelect: (key: string) => void;
}) {
  const [main, sub] = splitClassificationLabel(card.label);
  const pct = percentOf(card.flagged_count, card.denominator);
  const Icon = CLASSIFICATION_ICON[card.key] ?? IconActivity;
  const tone = CLASSIFICATION_TONE[card.key] ?? "blue";
  return (
    <button type="button" className={`anthro-screening-card anthro-screening-tone-${tone}`} onClick={() => onSelect(card.key)}>
      <div className="anthro-screening-card-head">
        <span className="anthro-screening-card-icon">
          <Icon width={16} height={16} />
        </span>
        <span className="anthro-screening-card-label">
          <span className="anthro-screening-card-label-main">{main}</span>
          {sub && <span className="anthro-screening-card-label-sub">{sub}</span>}
        </span>
        <IconChevron className="anthro-screening-card-chevron" width={14} height={14} />
      </div>
      <div className="anthro-screening-card-value">{card.denominator > 0 ? `${card.flagged_count} / ${card.denominator}` : "—"}</div>
      <div className="anthro-screening-card-sublabel">{pct !== null ? `${pct}% flagged` : "No eligible children"}</div>
    </button>
  );
}

export default function AnthropometryAssessment() {
  const [data, setData] = useState<AnthropometryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const [sexFilter, setSexFilter] = useState("all");
  const [screeningFilter, setScreeningFilter] = useState("all");
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementKey>("height");
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setError(null);
    getAnthropometry()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  const ageOptions = useMemo(
    () => (data ? Array.from(new Set(data.rows.map((r) => ageGroupOf(r.age_at_assessment)))).sort() : []),
    [data],
  );
  const sexOptions = useMemo(
    () => (data ? Array.from(new Set(data.rows.map((r) => r.sex).filter((s): s is string => Boolean(s)))).sort() : []),
    [data],
  );
  const screeningOptions = useMemo(() => {
    if (!data) return [];
    const values = new Set<string>();
    for (const r of data.rows) {
      for (const v of [r.height_screening, r.weight_screening, r.bmi_screening]) {
        if (screeningCellClass(v) === "anthro-screening-flag") values.add(v);
      }
    }
    return Array.from(values).sort();
  }, [data]);

  const filteredRows: AnthropometryChildRow[] = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q && !r.child_id.toLowerCase().includes(q)) return false;
      if (ageFilter !== "all" && ageGroupOf(r.age_at_assessment) !== ageFilter) return false;
      if (sexFilter !== "all" && r.sex !== sexFilter) return false;
      if (
        screeningFilter !== "all" &&
        ![r.height_screening, r.weight_screening, r.bmi_screening].includes(screeningFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [data, search, ageFilter, sexFilter, screeningFilter]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading Anthropometry Assessment..." />;

  const { completion } = data;
  const sexDistribution = data.sex_distribution.map((c) => ({ label: c.code, count: c.count }));
  const sexTotal = sexDistribution.reduce((s, c) => s + c.count, 0);
  const ageDistribution = data.age_distribution.map((b) => ({ label: `${b.label} (${b.percent}%)`, count: b.count }));
  const ageTotal = data.age_distribution.reduce((s, b) => s + b.count, 0);
  const assessedPercent = percentOf(data.unique_children_with_valid_data, completion.total_registered);
  const selectedField = MEASUREMENT_FIELDS.find((f) => f.key === selectedMeasurement) ?? MEASUREMENT_FIELDS[0];

  return (
    <section className="anthro-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Anthropometry Assessment"
        subtitle="Height, weight, MUAC and circumference measurements for children aged 8-10 years - live REDCap instrument."
      />

      <div className="module-status-line anthro-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
        {data.latest_assessment_date && (
          <span className="anthro-latest-assessment">
            <IconCalendar width={13} height={13} />
            Latest assessment: {data.latest_assessment_date}
          </span>
        )}
      </div>

      <SectionHeader title="Cohort at a Glance" />
      <div className="kpi-row">
        <KpiCard
          icon={IconUsers}
          label="Children Assessed"
          value={`${data.unique_children_with_valid_data} / ${completion.total_registered}`}
          progress={{ value: data.unique_children_with_valid_data, total: completion.total_registered }}
          sublabel={assessedPercent !== null ? `${assessedPercent}% of registered cohort` : undefined}
          tone="blue"
        />
        <KpiCard
          icon={IconActivity}
          label="Assessment Records"
          value={data.total_assessment_records}
          sublabel="with a recorded date"
          tone="violet"
        />
        <KpiCard
          icon={IconChart}
          label="Median Height"
          value={data.height.median !== null ? `${fmt(data.height.median)} cm` : "—"}
          sublabel={
            data.height.q1 !== null && data.height.q3 !== null
              ? `IQR ${fmt(data.height.q1)}–${fmt(data.height.q3)} · n=${data.height.valid_n}`
              : "No data yet"
          }
          tone="aqua"
        />
        <KpiCard
          icon={IconFlag}
          label="Median Weight"
          value={data.weight.median !== null ? `${fmt(data.weight.median)} kg` : "—"}
          sublabel={
            data.weight.q1 !== null && data.weight.q3 !== null
              ? `IQR ${fmt(data.weight.q1)}–${fmt(data.weight.q3)} · n=${data.weight.valid_n}`
              : "No data yet"
          }
          tone="amber"
        />
      </div>

      <SectionHeader title="Growth Profile" />
      <div className="chart-grid two-col">
        <div className="table-card anthro-profile-summary-card">
          <p className="chart-card-subtitle" style={{ padding: "var(--space-4) var(--space-4) 0" }}>
            Anthropometric Summary
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Measurement</th>
                <th>Median (IQR)</th>
                <th>Mean &plusmn; SD</th>
                <th>Valid N</th>
                <th>Completeness</th>
              </tr>
            </thead>
            <tbody>
              {MEASUREMENT_FIELDS.map((field) => {
                const s = data[field.key];
                return (
                  <tr key={field.key}>
                    <td>{field.label}</td>
                    <td>
                      {fmt(s.median)}
                      {s.q1 !== null && s.q3 !== null ? ` (${fmt(s.q1)}–${fmt(s.q3)})` : ""}
                    </td>
                    <td>
                      {fmt(s.mean)}
                      {s.std_dev !== null ? ` ± ${fmt(s.std_dev)}` : ""}
                    </td>
                    <td>{s.valid_n}</td>
                    <td className="anthro-completeness-cell">
                      <ProportionBar value={s.valid_n} total={s.total} />
                      <span>{s.percent_valid}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ChartCard title="Age and Sex Distribution">
          <div className="anthro-profile-subsection">
            <p className="anthro-profile-subheading">Sex distribution (n={sexTotal})</p>
            {sexDistribution.length > 0 ? (
              <DonutChart data={sexDistribution} height={160} centerValue={sexTotal} centerLabel="children" />
            ) : (
              <p className="chart-card-note">No sex recorded yet.</p>
            )}
          </div>
          <div className="anthro-profile-subsection">
            <p className="anthro-profile-subheading">Age at assessment (n={ageTotal})</p>
            {ageDistribution.length > 0 ? (
              <CategoryBarChart data={ageDistribution} mode="sequential" height={160} xTickMaxChars={12} />
            ) : (
              <p className="chart-card-note">No age-at-assessment data available yet.</p>
            )}
          </div>
        </ChartCard>
      </div>

      <SectionHeader title="Growth Screening" note="IAP 2015 (ages 5-18) - screening flags, not diagnoses" />
      <div className="anthro-screening-grid">
        {data.classifications.map((c) => (
          <ScreeningCard
            key={c.key}
            card={c}
            onSelect={(key) => {
              setScreeningFilter(KEY_TO_FLAGGED_VALUE[key] ?? "all");
              reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ))}
      </div>

      <SectionHeader title="Explore Measurements" note="View distribution of recorded measurements. Select a measurement to explore in detail." />
      <div className="anthro-measure-tabs">
        {MEASUREMENT_FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`anthro-measure-tab${selectedMeasurement === f.key ? " anthro-measure-tab-active" : ""}`}
            onClick={() => setSelectedMeasurement(f.key)}
          >
            {f.label} ({f.unit})
          </button>
        ))}
      </div>
      <MeasurementDetail field={selectedField} summary={data[selectedMeasurement]} />

      <SectionHeader title="Measurement Completeness" note="Data availability for each anthropometric measurement." />
      <div className="table-card anthro-completeness-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Measurement</th>
              <th>Valid N</th>
              <th>Missing N</th>
              <th>Invalid N</th>
              <th>Completeness</th>
            </tr>
          </thead>
          <tbody>
            {MEASUREMENT_FIELDS.map((field) => {
              const summary = data[field.key];
              const invalid = field.key === "bmi" ? null : data.data_quality.invalid_measurement_counts[field.key] ?? 0;
              return (
                <tr key={field.key}>
                  <td>{field.label}</td>
                  <td>{summary.valid_n}</td>
                  <td>{summary.missing_n}</td>
                  <td>{invalid === null ? "—" : invalid}</td>
                  <td className="anthro-completeness-cell">
                    <ProportionBar value={summary.valid_n} total={summary.total} />
                    <span>{summary.percent_valid}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={reviewRef}>
        <SectionHeader title="Child-Level Review" note="For study-team review - no free-text remarks shown" />
        <div className="anthro-review-controls">
          <input
            type="text"
            className="anthro-review-search"
            placeholder="Search Child ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search Child ID"
          />
          <select
            className="anthro-review-select"
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
            aria-label="Filter by age group"
          >
            <option value="all">All ages</option>
            {ageOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className="anthro-review-select"
            value={sexFilter}
            onChange={(e) => setSexFilter(e.target.value)}
            aria-label="Filter by sex"
          >
            <option value="all">Gender</option>
            {sexOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="anthro-review-select"
            value={screeningFilter}
            onChange={(e) => setScreeningFilter(e.target.value)}
            aria-label="Filter by screening result"
          >
            <option value="all">All screening results</option>
            {screeningOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="anthro-table-wrap">
          <table className="anthro-table">
            <thead>
              <tr>
                <th>Child ID</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Height (cm)</th>
                <th>Weight (kg)</th>
                <th>MUAC (cm)</th>
                <th>Head (cm)</th>
                <th>Waist (cm)</th>
                <th>Hip (cm)</th>
                <th>BMI</th>
                <th className="anthro-screening-cell">Height Screening</th>
                <th className="anthro-screening-cell">Weight Screening</th>
                <th className="anthro-screening-cell">BMI Screening</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.child_id}>
                  <td className="anthro-id-cell">{row.child_id}</td>
                  <td>{row.age_at_assessment ?? "—"}</td>
                  <td>{row.sex ?? "—"}</td>
                  <td>{fmt(row.height_cm)}</td>
                  <td>{fmt(row.weight_kg)}</td>
                  <td>{fmt(row.muac_cm)}</td>
                  <td>{fmt(row.head_circumference_cm)}</td>
                  <td>{fmt(row.waist_circumference_cm)}</td>
                  <td>{fmt(row.hip_circumference_cm)}</td>
                  <td>{fmt(row.bmi, 2)}</td>
                  <td
                    className={`anthro-screening-cell ${screeningCellClass(row.height_screening)}`}
                    title={row.height_screening === "Not available" ? row.screening_note : row.reference_used}
                  >
                    {row.height_screening}
                  </td>
                  <td
                    className={`anthro-screening-cell ${screeningCellClass(row.weight_screening)}`}
                    title={row.weight_screening === "Not available" ? row.screening_note : row.reference_used}
                  >
                    {row.weight_screening}
                  </td>
                  <td
                    className={`anthro-screening-cell ${screeningCellClass(row.bmi_screening)}`}
                    title={row.bmi_screening === "Not available" ? row.screening_note : row.reference_used}
                  >
                    {row.bmi_screening}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && <p className="ats-pstatus-empty">No children match this search/filter.</p>}
        </div>
      </div>
    </section>
  );
}
