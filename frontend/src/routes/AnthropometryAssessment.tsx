import { useEffect, useMemo, useState } from "react";

import { getAnthropometry } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import FullScreenLoader from "../components/FullScreenLoader";
import { IconActivity, IconCalendar, IconUsers } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { useRefresh } from "../context/RefreshContext";
import type { AnthropometryChildRow, AnthropometryResponse, MeasurementSummary } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

type MeasurementKey = "height" | "weight" | "muac" | "head_circumference" | "waist_circumference" | "hip_circumference";

const MEASUREMENT_FIELDS: { key: MeasurementKey; label: string; unit: string }[] = [
  { key: "height", label: "Height", unit: "cm" },
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "muac", label: "MUAC", unit: "cm" },
  { key: "head_circumference", label: "Head Circumference", unit: "cm" },
  { key: "waist_circumference", label: "Waist Circumference", unit: "cm" },
  { key: "hip_circumference", label: "Hip Circumference", unit: "cm" },
];

function fmt(n: number | null, digits = 1): string {
  return n === null ? "—" : n.toFixed(digits);
}

function ageGroupOf(age: number | null): string {
  if (age === null) return "Unknown";
  if (age === 8 || age === 9 || age === 10) return `${age} years`;
  return "Other";
}

function MeasurementCard({ field, summary }: { field: { key: MeasurementKey; label: string; unit: string }; summary: MeasurementSummary }) {
  const histogram = summary.histogram.map((c) => ({ label: c.code, count: c.count }));
  return (
    <ChartCard
      title={`${field.label} (${field.unit})`}
      subtitle={`n=${summary.valid_n}/${summary.total} valid (${summary.percent_valid}%)`}
      compact
    >
      <div className="anthro-measurement-stats">
        <div className="anthro-measurement-stat">
          <span className="anthro-measurement-stat-label">Median (IQR)</span>
          <span className="anthro-measurement-stat-value">
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
        <CategoryBarChart data={histogram} mode="sequential" height={120} xTickMaxChars={8} />
      ) : (
        <p className="chart-card-note">No valid measurements recorded yet.</p>
      )}
    </ChartCard>
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

  const filteredRows: AnthropometryChildRow[] = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q && !r.child_id.toLowerCase().includes(q)) return false;
      if (ageFilter !== "all" && ageGroupOf(r.age_at_assessment) !== ageFilter) return false;
      if (sexFilter !== "all" && r.sex !== sexFilter) return false;
      return true;
    });
  }, [data, search, ageFilter, sexFilter]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading Anthropometry Assessment..." />;

  const { completion } = data;
  const sexDistribution = data.sex_distribution.map((c) => ({ label: c.code, count: c.count }));
  const ageDistribution = data.age_distribution.map((b) => ({ label: `${b.label} (${b.percent}%)`, count: b.count }));

  return (
    <section className="anthro-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Anthropometry Assessment"
        subtitle="Height, weight, MUAC and circumference measurements for children aged 8-10 years - live REDCap instrument."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      <SectionHeader title="Cohort Overview" />
      <div className="kpi-row">
        <KpiCard
          icon={IconUsers}
          label="Unique Children With Valid Data"
          value={data.unique_children_with_valid_data}
          sublabel={`of ${completion.total_registered} registered`}
          tone="blue"
        />
        <KpiCard
          icon={IconActivity}
          label="Total Assessment Records"
          value={data.total_assessment_records}
          sublabel="records with a recorded assessment date"
          tone="aqua"
        />
        <KpiCard
          icon={IconCalendar}
          label="Latest Recorded Assessment"
          value={data.latest_assessment_date ?? "—"}
          sublabel={data.latest_assessment_date ? "most recent assessment date" : "No assessments recorded yet"}
          tone="violet"
        />
      </div>

      <SectionHeader title="Measurements" note="Median (IQR) primary; mean &plusmn; SD secondary" />
      <div className="chart-grid three-col">
        {MEASUREMENT_FIELDS.map((field) => (
          <MeasurementCard key={field.key} field={field} summary={data[field.key]} />
        ))}
      </div>

      <SectionHeader title="Demographics & Completeness" />
      <div className="chart-grid two-col">
        <ChartCard title="Recorded Sex Distribution" subtitle={`n=${sexDistribution.reduce((s, c) => s + c.count, 0)} with sex recorded`}>
          {sexDistribution.length > 0 ? (
            <CategoryBarChart data={sexDistribution} mode="categorical" height={160} />
          ) : (
            <p className="chart-card-note">No sex recorded yet.</p>
          )}
        </ChartCard>
        <ChartCard
          title="Age at Assessment"
          subtitle="Computed from date of birth and assessment date - not current age"
        >
          {ageDistribution.length > 0 ? (
            <CategoryBarChart data={ageDistribution} mode="sequential" height={160} xTickMaxChars={12} />
          ) : (
            <p className="chart-card-note">No age-at-assessment data available yet.</p>
          )}
        </ChartCard>
      </div>

      <div className="table-card anthro-completeness-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Measurement</th>
              <th>Valid</th>
              <th>Missing</th>
              <th>Invalid</th>
              <th>Completeness</th>
            </tr>
          </thead>
          <tbody>
            {MEASUREMENT_FIELDS.map((field) => {
              const summary = data[field.key];
              return (
                <tr key={field.key}>
                  <td>{field.label}</td>
                  <td>{summary.valid_n}</td>
                  <td>{summary.missing_n}</td>
                  <td>{data.data_quality.invalid_measurement_counts[field.key] ?? 0}</td>
                  <td>{summary.percent_valid}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Data Quality" />
      <div className="table-card anthro-dq-card">
        <table className="data-table">
          <tbody>
            <tr>
              <td>Missing Child ID (among records with anthropometry data)</td>
              <td className="anthro-dq-value">{data.data_quality.missing_child_id_count}</td>
            </tr>
            <tr>
              <td>Missing Assessment Date (among engaged records)</td>
              <td className="anthro-dq-value">{data.data_quality.missing_assessment_date_count}</td>
            </tr>
            <tr>
              <td>Possible Duplicate Records (by Child ID)</td>
              <td className="anthro-dq-value">{data.data_quality.possible_duplicate_count}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {data.data_quality.possible_duplicate_ids.length > 0 && (
        <DetailDisclosure summary={`Possible duplicate Child IDs (${data.data_quality.possible_duplicate_ids.length})`}>
          <p className="chart-card-note">{data.data_quality.possible_duplicate_ids.join(", ")}</p>
        </DetailDisclosure>
      )}

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
          <option value="all">All sexes</option>
          {sexOptions.map((s) => (
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
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="ats-pstatus-empty">No children match this search/filter.</p>}
      </div>
    </section>
  );
}
