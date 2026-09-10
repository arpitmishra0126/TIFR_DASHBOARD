import { useEffect, useState } from "react";

import { getScreenTime } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DonutChart from "../components/DonutChart";
import { IconBrain, IconCalendar, IconClipboardAlert, IconClipboardCheck, IconMonitor } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import StudyDataLoader from "../components/StudyDataLoader";
import GroupedBarChart from "../components/charts/GroupedBarChart";
import ScreenActivityScatter from "../components/charts/ScreenActivityScatter";
import { useRefresh } from "../context/RefreshContext";
import type { GroupedMinutesPoint, MinutesSummary, PairedMinutesPoint, ScoreSummary, ScreenTimeResponse } from "../types/liveDashboard";

const TIER_BADGE_TONE: Record<string, "good" | "neutral" | "warning"> = {
  High: "good",
  Partial: "warning",
  "No Data": "neutral",
};

const FUTURE_ANALYSES = [
  "Screen Time × SANGIAN",
  "Screen Time × Visual Working Memory",
  "Screen Time × DCCS",
  "Screen Time × Colour Detection Task",
  "Screen Time × ASER",
];

function minutesLabel(value: number | null): string {
  return value === null ? "—" : `${value} min`;
}

// Approved DSEQ coding specification (2026-09-10). Each card's value is a
// derived coded-score summary (pooled or single-field mean of REDCap's own
// numeric codes) - a descriptive statistic, not a validated clinical scale.
function codingScoreValue(summary: ScoreSummary): string {
  return summary.mean !== null ? summary.mean.toFixed(2) : "-";
}

function codingScoreSublabel(summary: ScoreSummary, range: string): string {
  if (summary.valid_n === 0) return `${range} · no data (0/${summary.total})`;
  return `${range} · n=${summary.valid_n}/${summary.total} (${summary.percent_valid}%)`;
}

function pairedToGrouped(points: PairedMinutesPoint[]) {
  return points.map((p) => ({
    group: p.group,
    values: { mean: p.mean, median: p.median },
    validN: { mean: p.valid_n, median: p.valid_n },
  }));
}

function groupedToBar(points: GroupedMinutesPoint[]) {
  return points.map((p) => ({
    // n is folded into the axis label itself (not just the hover tooltip)
    // so the denominator behind each group's mean is always visible.
    group: `${p.group} (n=${p.valid_n})`,
    values: { mean: p.mean },
    validN: { mean: p.valid_n },
  }));
}

function FutureAnalysisCard({ label }: { label: string }) {
  return (
    <div className="instrument-card instrument-card-placeholder">
      <div className="instrument-card-top">
        <div className="instrument-card-icon instrument-card-icon-muted">
          <IconBrain width={18} height={18} />
        </div>
      </div>
      <div className="instrument-card-name">{label}</div>
      <div className="instrument-card-body">
        <div className="instrument-card-status-row">
          <StatusBadge label="Under Development" tone="neutral" />
        </div>
        <div className="instrument-card-expanded">Data for this analysis is not currently available in the dashboard.</div>
      </div>
    </div>
  );
}

export default function ScreenTime() {
  const [data, setData] = useState<ScreenTimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getScreenTime()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading assessment data" subLabel="Connecting to live REDCap data…" />;

  const { completion } = data;
  const avg = data.average_daily_summary;
  const school = data.school_day_summary;
  const weekend = data.weekend_summary;
  const diff = data.difference_summary;

  const distributionMinutes = data.screen_time_distribution_minutes.map((c) => ({ label: c.code, count: c.count }));
  const diffDistribution = data.difference_distribution.map((c) => ({ label: c.code, count: c.count }));
  const purposeDonut = data.purpose_distribution.map((c) => ({ label: c.code, count: c.count }));
  const supervisionBar = data.supervision_distribution.map((c) => ({ label: c.code, count: c.count }));
  const householdDonut = data.household_rules_distribution.map((c) => ({ label: c.code, count: c.count }));
  const legacyDistribution = data.total_screen_time_distribution.map((c) => ({ label: c.code, count: c.count }));

  const deviceStacked = [
    {
      group: "Average Daily Minutes",
      values: Object.fromEntries(data.by_device.map((d) => [d.device, d.mean_minutes])),
      validN: Object.fromEntries(data.by_device.map((d) => [d.device, d.valid_n])),
    },
  ];
  const deviceSeries = data.by_device.map((d) => ({ key: d.device, label: d.device }));

  const paSchool = data.physical_activity_school_day_summary;
  const paWeekend = data.physical_activity_weekend_summary;
  const paAnyData = paSchool.valid_n > 0 || paWeekend.valid_n > 0;
  const scatterAnyData = data.screen_vs_activity_scatter.length > 0;

  const summaryOf = (m: MinutesSummary) => `n=${m.valid_n}/${m.total} · median ${minutesLabel(m.median)}`;

  return (
    <section className="screen-time-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Screen Time"
        subtitle="Digital Screen Exposure Questionnaire (DSEQ) - live REDCap instrument. Average/median minutes below are estimated from DSEQ's banded duration items, converted to each band's midpoint - not an exact measurement."
      />

      <div className="module-status-line">
        <StatusBadge
          label={`Instrument Completion: ${completion.completed}/${completion.total_registered} (${completion.percent}%)`}
          tone={TIER_BADGE_TONE[completion.coverage_tier] ?? "neutral"}
        />
      </div>

      {/* --- DSEQ Coding Scores --- */}
      <SectionHeader title="DSEQ Coding Scores" note="Derived coded scores · not validated clinical scale scores" />
      <div className="kpi-row coding-score-row">
        <KpiCard
          tone="blue"
          label="Frequency Score"
          value={codingScoreValue(data.coding_scores.frequency)}
          sublabel={codingScoreSublabel(data.coding_scores.frequency, "Range 0–3")}
        />
        <KpiCard
          tone="violet"
          label="Duration Score"
          value={codingScoreValue(data.coding_scores.duration)}
          sublabel={codingScoreSublabel(data.coding_scores.duration, "Range 0–4")}
        />
        <KpiCard
          tone="aqua"
          label="Supervision Score"
          value={codingScoreValue(data.coding_scores.supervision)}
          sublabel={codingScoreSublabel(data.coding_scores.supervision, "Range 0–3")}
        />
        <KpiCard
          tone="amber"
          label="Household Rules Score"
          value={codingScoreValue(data.coding_scores.household_rules)}
          sublabel={codingScoreSublabel(data.coding_scores.household_rules, "Range 0–1")}
        />
      </div>

      {/* --- Screen Time Summary --- */}
      <SectionHeader title="Screen Time Summary" note="Primary continuous variable: estimated minutes/day, not screen-time categories" />
      <div className="kpi-row kpi-row-balanced-6">
        <KpiCard
          icon={IconClipboardCheck}
          tone="blue"
          label="DSEQ Assessments Completed"
          value={`${completion.completed}/${completion.total_registered}`}
          sublabel={`${completion.percent}% of registered`}
        />
        <KpiCard
          icon={IconMonitor}
          tone="violet"
          label="Estimated Average Daily Screen Time"
          value={minutesLabel(avg.mean)}
          sublabel={`5:2 school-day/weekend weighted estimate · ${summaryOf(avg)}`}
        />
        <KpiCard
          icon={IconMonitor}
          tone="violet"
          label="Median Daily Screen Time (est.)"
          value={minutesLabel(avg.median)}
          sublabel={`n=${avg.valid_n}/${avg.total} valid`}
        />
        <KpiCard
          icon={IconCalendar}
          tone="aqua"
          label="School-Day Screen Time (est.)"
          value={minutesLabel(school.mean)}
          sublabel={`Median ${minutesLabel(school.median)} · n=${school.valid_n}/${school.total}`}
        />
        <KpiCard
          icon={IconCalendar}
          tone="amber"
          label="Weekend Screen Time (est.)"
          value={minutesLabel(weekend.mean)}
          sublabel={`Median ${minutesLabel(weekend.median)} · n=${weekend.valid_n}/${weekend.total}`}
        />
        <KpiCard
          icon={IconClipboardAlert}
          tone="neutral"
          label="Missing DSEQ Data"
          value={`${data.missing_count}/${completion.total_registered}`}
          sublabel={`${data.missing_percent}% of registered`}
        />
      </div>

      {/* --- School-Day vs Weekend --- */}
      <SectionHeader title="School-Day vs Weekend" note="Estimated minutes/day, per child with both sides answered" />
      <div className="chart-grid two-col">
        <ChartCard title="School-Day vs Weekend Screen Time" subtitle="Mean and median, minutes/day (est.)">
          <GroupedBarChart data={pairedToGrouped(data.school_vs_weekend)} series={[{ key: "mean", label: "Mean" }, { key: "median", label: "Median" }]} unit=" min" />
        </ChartCard>
        <ChartCard
          title="Weekend − School-Day Difference"
          subtitle={`Mean ${minutesLabel(diff.mean)} · valid n=${diff.valid_n}/${diff.total}`}
          note="Weekend minutes minus school-day minutes, per child; histogram of the derived difference"
        >
          <CategoryBarChart data={diffDistribution} mode="sequential" xTickMaxChars={9} />
        </ChartCard>
      </div>

      {/* --- Screen-Time Distribution --- */}
      <SectionHeader title="Screen-Time Distribution" note="Estimated average daily minutes, bucketed - primary continuous variable" />
      <div className="chart-grid two-col">
        <ChartCard title="Distribution of Estimated Average Daily Screen Time" subtitle={`n=${avg.valid_n}/${avg.total} valid observations`}>
          <CategoryBarChart data={distributionMinutes} mode="sequential" />
        </ChartCard>
        <ChartCard title="Distribution of Total Daily Screen Time (DSEQ Q10)" subtitle="Secondary, self-reported category - descriptive only">
          <CategoryBarChart data={legacyDistribution} mode="categorical" />
        </ChartCard>
      </div>

      {/* --- Screen Time by Demographics --- */}
      <SectionHeader title="Screen Time by Demographics" note="Mean estimated minutes/day, primary continuous variable" />
      <div className="chart-grid two-col">
        <ChartCard title="Screen Time by Age" subtitle="Ages 8, 9 and 10 - study-specific groups">
          <GroupedBarChart data={groupedToBar(data.by_age)} series={[{ key: "mean", label: "Mean minutes/day" }]} unit=" min" />
        </ChartCard>
        <ChartCard title="Screen Time by Sex" subtitle="Mean minutes/day">
          <GroupedBarChart data={groupedToBar(data.by_sex)} series={[{ key: "mean", label: "Mean minutes/day" }]} unit=" min" />
        </ChartCard>
      </div>

      {/* --- Screen Use & Supervision --- */}
      <SectionHeader title="Screen Use & Supervision" note={`Among children who completed DSEQ (n=${completion.completed})`} />
      <div className="chart-grid two-col">
        <ChartCard title="Screen Time by Device" subtitle="Mean estimated minutes/day - TV and smartphone/tablet only">
          <GroupedBarChart data={deviceStacked} series={deviceSeries} stacked unit=" min" />
          <p className="chart-card-note">
            Laptop/computer excluded - REDCap records only its weekly-use frequency, not duration.
          </p>
        </ChartCard>
        <ChartCard title="Screen-Use Purpose" subtitle="DSEQ Q13, primary reported use">
          <DonutChart data={purposeDonut} />
        </ChartCard>
      </div>
      <div className="chart-grid two-col">
        <ChartCard title="Parental Supervision" subtitle="DSEQ Q8, ordered Never → Always">
          <CategoryBarChart data={supervisionBar} mode="sequential" />
        </ChartCard>
        <ChartCard title="Household Screen Rules" subtitle={`DSEQ Q9 · n=${data.household_rules_valid_n}/${completion.total_registered}`}>
          <DonutChart data={householdDonut} />
        </ChartCard>
      </div>

      {/* --- Physical Activity (DSEQ Section B) --- */}
      <SectionHeader title="Physical Activity" note="DSEQ Section B (outdoor play), separate from the PAQ-C Physical Activity page" />
      {paAnyData ? (
        <div className="chart-grid two-col">
          <ChartCard title="Outdoor Play: School-Day vs Weekend" subtitle="Mean and median, minutes/day (est.)">
            <GroupedBarChart
              data={pairedToGrouped(data.physical_activity_school_vs_weekend)}
              series={[{ key: "mean", label: "Mean" }, { key: "median", label: "Median" }]}
              unit=" min"
            />
          </ChartCard>
          <ChartCard
            title="Screen Time vs Physical Activity"
            subtitle={scatterAnyData ? `n=${data.screen_vs_activity_scatter.length} children with both values` : undefined}
          >
            {scatterAnyData ? (
              <ScreenActivityScatter data={data.screen_vs_activity_scatter} />
            ) : (
              <p className="chart-card-note">No children currently have both a valid screen-time and physical-activity estimate.</p>
            )}
          </ChartCard>
        </div>
      ) : (
        <ChartCard title="Physical Activity" subtitle="DSEQ Section B (q11/q12)">
          <p className="chart-card-note">No valid outdoor-play data acquired yet for this instrument.</p>
        </ChartCard>
      )}

      {/* --- Future Cognitive/Developmental Analysis --- */}
      <SectionHeader title="Future Cognitive/Developmental Analysis" note="Placeholders only - no data acquired from these instruments yet" />
      <div className="instrument-grid">
        {FUTURE_ANALYSES.map((label) => (
          <FutureAnalysisCard key={label} label={label} />
        ))}
      </div>
    </section>
  );
}
