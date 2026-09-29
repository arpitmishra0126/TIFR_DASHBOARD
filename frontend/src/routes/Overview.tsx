import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { getAssessmentTimeline, getAssessmentToolStatus, getHealthScreening, getOverview, getRegistry, getScreenTime } from "../api/dashboard";
import { percentOf } from "../components/charts/chartHelpers";
import DataLoadError from "../components/DataLoadError";
import FullScreenLoader from "../components/FullScreenLoader";
import {
  IconBrain,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconChevron,
  IconClipboardCheck,
  IconClock,
  IconDocument,
  IconExternalLink,
  IconHeart,
  IconHome,
  IconMonitor,
  IconProgress,
  IconPulse,
  IconUsers,
} from "../components/icons";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ReferenceArea, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipBox } from "../components/charts/ChartTooltip";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import type {
  AssessmentTimelineResponse,
  AssessmentToolStatusResponse,
  HealthScreeningResponse,
  OverviewResponse,
  RegistryChild,
  ScreenTimeResponse,
} from "../types/liveDashboard";
import { INSTRUMENT_COLUMNS } from "./Registry";

/** Dashboard rebuilt as a central STUDY INFORMATION HUB (2026-09-28) -
 * a quick, one-screen overview of the whole study flow and an entry point
 * into deeper module pages, not a second analytics page. The previous
 * version's large detailed Assessment Progress table, full 3-column Study
 * Profile breakdown, 8-row Assessment Coverage list, right-hand detail
 * panel, and Quick Actions list were all removed from this page per
 * explicit instruction - none of the underlying data/calculations were
 * deleted, they were either condensed into a one-line summary here (Study
 * Snapshot) or relocated to their proper dedicated page (the participant-
 * level Assessment Tool Status table now lives on `/assessment-tool-
 * status`; the Excel/CSV exports already lived on `/registry`
 * independently, so nothing was lost by removing the duplicate Quick
 * Actions buttons here).
 *
 * Every figure on this page is read from the existing `/dashboard/overview`,
 * `/dashboard/assessment-tool-status`, `/dashboard/screen-time`, and
 * `/dashboard/health` responses - no new backend endpoint, field, or
 * calculation was added; the last two were already-existing endpoints,
 * simply not previously fetched by this page. */

type Tone = "blue" | "teal" | "violet" | "amber" | "cyan" | "pink";

function MonitorBar({ percent, tone = "blue" }: { percent: number; tone?: Tone }) {
  return (
    <div className={`monitor-bar monitor-bar-tone-${tone}`}>
      <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

/** "Study Progress" pipeline - a proper document-flow layout (2026-09-28,
 * third pass): Registration (standalone anchor) -> a dedicated static
 * connector -> a clearly bordered "Core Data Collection" section (its own
 * heading + a CSS Grid of the 8 parallel module cards, no sequential order
 * implied among them) -> another dedicated static connector -> Assessment
 * Tools (standalone anchor). Nothing is absolutely positioned across the
 * whole component, so a connector can never overlap a card - every
 * connector is a normal flex child occupying its own row. Every count/
 * percent is a direct read of `overview.all_instrument_coverage` /
 * `assessmentToolStatus.overall_participant` - no new calculation. The
 * only animated element is the pair of short horizontal rule segments in
 * the Core Data Collection heading (a scrolling dashed highlight, CSS
 * only) - both dedicated vertical connectors stay static, since a vertical
 * connector must never receive the horizontal scrolling treatment. */
interface PipelineNodeData {
  key: string;
  label: string;
  count: number;
  total: number;
  tone: Tone;
  linkTo?: string;
  /** SSRS-only (2026-09-28 senior requirement): Parent/Child/Teacher shown
   * as one consolidated module rather than three separate cards. When
   * present, the card renders these lines instead of a single count/total
   * line - each still denominated by the same `total` (222, the overall
   * study cohort) as the rest of the Study Progress visualization. */
  breakdown?: { label: string; count: number }[];
}

function PipelineNode({ node }: { node: PipelineNodeData }) {
  const hasBreakdown = !!node.breakdown && node.breakdown.length > 0;
  const percent = percentOf(node.count, node.total);
  const complete = !hasBreakdown && percent >= 100;
  const className = `pipeline-node monitor-tone-${node.tone}${complete ? " pipeline-node-complete" : ""}${
    node.linkTo ? " pipeline-node-clickable" : ""
  }`;
  const content = (
    <>
      <span className="pipeline-node-label">{node.label}</span>
      {hasBreakdown ? (
        <span className="pipeline-node-breakdown">
          {node.breakdown!.map((item) => {
            const itemPercent = percentOf(item.count, node.total);
            return (
              <span key={item.label} className="pipeline-node-breakdown-item">
                <span className="pipeline-node-breakdown-text">
                  {item.label} {item.count}/{node.total} <span className="pipeline-node-percent">({itemPercent}%)</span>
                </span>
                <MonitorBar percent={itemPercent} tone={node.tone} />
              </span>
            );
          })}
        </span>
      ) : (
        <>
          <span className="pipeline-node-value">
            {node.count}/{node.total} <span className="pipeline-node-percent">({percent}%)</span>
          </span>
          <MonitorBar percent={percent} tone={node.tone} />
        </>
      )}
    </>
  );
  return node.linkTo ? (
    <Link to={node.linkTo} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function PipelineConnector() {
  return (
    <div className="pipeline-connector" aria-hidden="true">
      <span className="pipeline-connector-line" />
      <span className="pipeline-connector-arrow" />
    </div>
  );
}

function StudyProgressPipeline({
  registration,
  coreModules,
  assessmentTools,
}: {
  registration: PipelineNodeData;
  coreModules: PipelineNodeData[];
  assessmentTools: PipelineNodeData | null;
}) {
  return (
    <div className="pipeline">
      <div className="pipeline-anchor">
        <PipelineNode node={registration} />
      </div>

      <PipelineConnector />

      <div className="pipeline-core-section">
        <div className="pipeline-core-heading">
          <span className="pipeline-core-heading-line" />
          <span className="pipeline-core-heading-label">Core Data Collection</span>
          <span className="pipeline-core-heading-line" />
        </div>
        <div className="pipeline-core-grid">
          {coreModules.map((node) => (
            <PipelineNode key={node.key} node={node} />
          ))}
        </div>
      </div>

      {assessmentTools && (
        <>
          <PipelineConnector />
          <div className="pipeline-anchor">
            <PipelineNode node={assessmentTools} />
          </div>
        </>
      )}
    </div>
  );
}

/** Fixed colour mapping for the Study Snapshot Sex Distribution split bar -
 * a presentation choice only, not a new data field. */
function sexTone(label: string): Tone {
  if (label === "Male") return "blue";
  if (label === "Female") return "pink";
  return "amber";
}

/** A thin, square-ended horizontal split bar (e.g. Male/Female proportion)
 * - segments sized directly by their own real percent share, never a
 * rounded/pill shape. */
function SplitBar({ segments }: { segments: { tone: Tone; percent: number }[] }) {
  return (
    <div className="split-bar">
      {segments.map((segment, index) => (
        <div key={index} className={`split-bar-segment monitor-tone-${segment.tone}`} style={{ width: `${segment.percent}%` }} />
      ))}
    </div>
  );
}

/** Key Study Modules panel (2026-09-28, pixel-target restyle) - a fully
 * reusable, generic `<DonutRing>` used for both the large per-card
 * completion donut and every small mini-donut, plus a `<ModuleCard>` shell
 * (header/body/footer zones) that both the DSEQ and Child Health cards are
 * built from, so the two panels can never structurally drift apart. All
 * colours/radii/spacing for this panel are CSS custom properties scoped
 * under `.key-modules-panel` (see app.css) - a self-contained design system
 * for this one section, not a change to the rest of the dashboard's shared
 * tokens. Ring arcs animate from 0 on mount and respect
 * `prefers-reduced-motion` (the transition itself is disabled under
 * `reduce` in CSS, so a reduced-motion viewer sees the final arc
 * immediately, never a frozen half-drawn one). */

/** A generic completion ring, real SVG (no chart library) - the exact same
 * component draws the large per-card donut (with center content) and every
 * small mini-donut (no center content) per the mockup spec's own
 * `<DonutRing size stroke value color />` shape. */
function DonutRing({
  percent,
  size,
  strokeWidth,
  color,
  trackColor = "var(--kmp-track)",
  ariaLabel,
  variant = "large",
  children,
}: {
  percent: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  ariaLabel: string;
  variant?: "large" | "mini";
  children?: ReactNode;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = drawn ? (clamped / 100) * circumference : 0;
  return (
    <div className={`kmp-donut kmp-donut-${variant}`} role="img" aria-label={ariaLabel}>
      {/* The box's rendered pixel size is controlled entirely by CSS
          (`.kmp-donut-large`/`.kmp-donut-mini`, incl. responsive media
          queries) - the `size`/`strokeWidth` props only define the SVG's
          own coordinate system (viewBox), so the stroke scales down
          proportionally as the box shrinks instead of overflowing it. */}
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          className="kmp-donut-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ stroke: color }}
        />
      </svg>
      {children && <div className="kmp-donut-center">{children}</div>}
    </div>
  );
}

/** The large per-card completion donut - count/total, percent, and
 * "Instrument completion" centred inside the ring. Colour is always
 * `var(--tone-accent)`, resolved from whichever `monitor-tone-*` ancestor
 * (the card itself, or a per-row override - see `IndicatorRow`) wraps it -
 * the same reusable tone-cascade already used dashboard-wide, not a new
 * hardcoded palette. */
function ModuleCompletionDonut({ count, total, label }: { count: number; total: number; label: string }) {
  const percent = percentOf(count, total);
  // strokeWidth is in the ring's own 320-unit viewBox coordinate space, not
  // rendered px - at the CSS box sizes `.kmp-donut-large` actually renders
  // at (190-260px, see app.css), 18 viewBox units yields a genuinely thin
  // ~10.7-14.6px physical stroke, not a bulky ring.
  return (
    <DonutRing percent={percent} size={320} strokeWidth={18} color="var(--tone-accent)" variant="large" ariaLabel={`${label} instrument completion: ${count} of ${total}, ${percent}%`}>
      <span className="kmp-donut-value">
        {count} / {total}
      </span>
      <span className="kmp-donut-percent">{percent}%</span>
      <span className="kmp-donut-caption">Instrument completion</span>
    </DonutRing>
  );
}

/** One "Key Indicators" row (Child Health card) - icon chip, label, bold
 * right-aligned count/denominator, and a small mini-donut with its own
 * percent centred inside on the far right. `tone` optionally overrides the
 * card's own accent tone for just this row (e.g. amber/pink for a
 * different indicator) via the same `monitor-tone-*` class every other
 * tone-coloured element on this page already uses. */
function IndicatorRow({ icon, label, count, total, tone }: { icon: ReactNode; label: string; count: number; total: number; tone?: Tone }) {
  const percent = percentOf(count, total);
  return (
    <div className={`kmp-indicator-row${tone ? ` monitor-tone-${tone}` : ""}${percent === 0 ? " kmp-indicator-row-zero" : ""}`}>
      <span className="kmp-indicator-icon">{icon}</span>
      <span className="kmp-indicator-label">{label}</span>
      <span className="kmp-indicator-count">
        {count} / {total}
      </span>
      <DonutRing
        percent={percent}
        size={54}
        strokeWidth={7}
        color={percent > 0 ? "var(--tone-accent)" : "var(--kmp-mini-track)"}
        trackColor="var(--kmp-mini-track)"
        variant="mini"
        ariaLabel={`${label}: ${count} of ${total}, ${percent}%`}
      >
        <span className="kmp-indicator-percent">{percent}%</span>
      </DonutRing>
    </div>
  );
}

/** One "Screen time by day type" row (DSEQ card) - icon, label, the bold
 * minute value, and the existing shared `MonitorBar` (thin, rectangular,
 * square-ended - the same bar used dashboard-wide, not a new rounded/pill
 * shape) scaled against a configurable minutes ceiling (School-day/Weekend
 * are each read against a fixed, comparable daily scale, not against each
 * other). */
function DayTypeRow({ icon, label, minutes, maxMinutes, tone }: { icon: ReactNode; label: string; minutes: number; maxMinutes: number; tone: Tone }) {
  const percent = Math.min(100, Math.max(0, (minutes / maxMinutes) * 100));
  return (
    <div className="kmp-day-row">
      <div className="kmp-day-row-head">
        <span className="kmp-day-icon">{icon}</span>
        <span className="kmp-day-label">{label}</span>
        <span className="kmp-day-value">{Math.round(minutes)} min</span>
      </div>
      <MonitorBar percent={percent} tone={tone} />
    </div>
  );
}

/** The shared card shell - header (icon chip/title/description), a body
 * zone the caller fills, and a clickable footer link row (icon chip + bold
 * link text + a chevron pinned to the far right). The whole footer row is
 * the actual `<Link>` (not the whole card), matching the mockup's
 * "whole footer row is clickable" spec while keeping the header/body
 * selectable as plain text. */
function ModuleCard({
  to,
  tone,
  icon,
  title,
  description,
  footerIcon,
  footerLabel,
  children,
}: {
  to: string;
  tone: Tone;
  icon: ReactNode;
  title: string;
  description: string;
  footerIcon: ReactNode;
  footerLabel: string;
  children: ReactNode;
}) {
  return (
    <div className={`kmp-card monitor-tone-${tone}`}>
      <div className="kmp-card-header">
        <span className="kmp-card-icon">{icon}</span>
        <div>
          <h3 className="kmp-card-title">{title}</h3>
          <p className="kmp-card-description">{description}</p>
        </div>
      </div>
      <div className="kmp-card-body">{children}</div>
      <Link to={to} className="kmp-card-footer">
        <span className="kmp-card-footer-icon">{footerIcon}</span>
        <span className="kmp-card-footer-label">{footerLabel} →</span>
        <IconChevron className="kmp-card-footer-chevron" width={16} height={16} />
      </Link>
    </div>
  );
}

/** ==========================================================================
 * Assessment Progress panel (2026-09-29 rebuild, trend panel upgraded same
 * day once a real historical data source was confirmed) - one bordered
 * outer frame (`.ap-panel`) holding: a tinted "Overall Assessment" band, a
 * two-column row (cumulative trend chart | per-tool comparison bar chart),
 * and a clickable footer link. Reuses the same `monitor-tone-*` tone
 * cascade, `MonitorBar` (square-ended, `border-radius: 0`), and
 * `--radius-sharp` (3px) geometry already established by the Key Study
 * Modules panel above it.
 *
 * The left "trend" panel: the live `assessment_tool_status` instrument
 * itself (confirmed in `backend/app/ingestion/live_field_map.py`'s
 * `ASSESSMENT_TOOL_STATUS_ITEM_FIELDS`) has 9 Done/Not-Done radio fields
 * and one completion flag - no date field of any kind, and
 * `RegistryChild.visit_date` is a registration/visit date, not an
 * assessment-tool completion date, so neither can drive a real timeline. A
 * genuine per-field timestamp DOES exist, however, via the REDCap Logging
 * API (`content=log`) - REDCap's own change-audit trail, which records
 * exactly when each field's value was saved. `getAssessmentTimeline()`
 * (new endpoint, `GET /dashboard/assessment-timeline`) fetches and
 * reconstructs this server-side (`build_assessment_timeline` in
 * `module_analytics.py`), correctly handling Done -> Not Done reversals and
 * repeated edits (latest-value-as-of-each-point-in-time, not "ever became
 * Done"), and cross-checks its own final month against the live
 * `/assessment-tool-status` participant counts before calling itself
 * `reconciled`. The chart below renders **only** when `available &&
 * reconciled && series.length > 0` - any other case (fetch failure,
 * REDCap Logging permission revoked, or a reconciliation mismatch) falls
 * back to the explicit "Assessment timeline unavailable" state, never a
 * silently wrong chart. Because this is a data-entry timestamp (when a
 * staff member saved the field), not literally when the child sat the
 * test, the panel is labelled "Cumulative assessments **recorded**
 * over time" with an explicit note - never "assessment date"/"assessed
 * on". ========================================================== */

/** Same 4-tool colour/label config as `ASSESSMENT_TOOL_CONFIG` below,
 * reused for the trend chart's series so the two panels' colours always
 * agree (SANGIAN teal, VWM violet, DCCS cyan, CD amber). */
const ASSESSMENT_TIMELINE_SERIES: { key: "sangian" | "vwm" | "dccs" | "cd"; label: string; color: string }[] = [
  { key: "sangian", label: "SANGIAN", color: "var(--series-3)" },
  { key: "vwm", label: "VWM", color: "var(--series-violet)" },
  { key: "dccs", label: "DCCS", color: "var(--series-cyan)" },
  { key: "cd", label: "CD", color: "var(--series-4)" },
];

function formatTimelineMonth(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1, 1));
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Cumulative assessments recorded over time" - a real, single AREA CHART
 * (recharts `AreaChart`/`Area`, never `BarChart`/`Bar`) built entirely from
 * `AssessmentTimelineResponse.series`. Hover tooltip rows are sorted
 * descending by value.
 *
 * With 2+ real months, each tool renders as the standard interpolated
 * `Area` (a saturated line, more prominent than its own fill, connecting
 * the real points) - automatic, no code branch, exactly the normal
 * cumulative-area behaviour once more REDCap log history accumulates.
 *
 * With exactly 1 real month (the current live state), an interpolated
 * `Area` line mathematically cannot form a filled polygon from a single
 * (x, y) pair - there is no second x-position to draw a shape between.
 * Rather than fabricate a second/duplicate data point to force one
 * (explicitly disallowed), each tool's fill is instead drawn with
 * recharts' `ReferenceArea` given only `x2` = the one real month (`x1`
 * omitted, so recharts extends the fill from the plot's left edge up to
 * that real category - a genuine area anchored to the zero baseline,
 * culminating at the real point, still inside the SAME `<AreaChart>` as
 * the normal multi-month case; `Area` itself supplies only the line/dot
 * for this single point, `fill="transparent"`) - never a `Bar`/`BarChart`.
 *
 * Colour/opacity (2026-09-29 refinement, per an explicit correction that
 * the first version's overlapping fills read as one muddy blended block):
 * each series uses a flat, low-opacity `fillOpacity` (not a gradient - a
 * gradient's own higher-opacity top band was itself a contributor to the
 * "blended" look once 4 overlapping regions stacked) so overlapping fills
 * stay readable and distinct, while the LINE stroke (and the dot markers,
 * which match their line's colour) stays fully saturated - clearly more
 * prominent than its own fill, per the explicit "line darker than fill"
 * requirement. Dark mode uses an even lower fill opacity than light mode
 * (the app's existing `--series-*` tokens are already brighter/more
 * saturated in dark mode - the same opacity there would look heavier, not
 * lighter, so a lower value is needed for genuinely "extremely subtle"
 * fills, not a blind copy of the light-mode number) - read via the
 * existing `useTheme()` hook, the same one `Layout.tsx`'s theme toggle
 * already uses. */
const ASSESSMENT_TIMELINE_FILL_OPACITY = { light: 0.08, dark: 0.05 };

function AssessmentTimelineChart({ series }: { series: AssessmentTimelineResponse["series"] }) {
  const { theme } = useTheme();
  const fillOpacity = ASSESSMENT_TIMELINE_FILL_OPACITY[theme];
  const data = series.map((point) => ({ ...point, label: formatTimelineMonth(point.month) }));
  const singleMonth = data.length === 1;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
        <RechartsTooltip
          content={(tooltipProps) => {
            const point = tooltipProps.payload?.[0]?.payload as (AssessmentTimelineResponse["series"][number] & { label: string }) | undefined;
            if (!point) return null;
            const rows = ASSESSMENT_TIMELINE_SERIES.map((s) => ({ label: s.label, raw: point[s.key], color: s.color }))
              .sort((a, b) => b.raw - a.raw)
              .map((s) => ({
                label: s.label,
                value: (
                  <span style={{ color: s.color, fontWeight: 700 }}>
                    {s.raw.toLocaleString()}
                  </span>
                ),
              }));
            return <ChartTooltipBox active={tooltipProps.active} title={point.label} rows={rows} />;
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {singleMonth &&
          // Painted largest value first, smallest last (on top) - since all
          // 4 fills share the same x-range and zero baseline, the smaller
          // series would otherwise sit fully hidden beneath the larger
          // ones' translucent regions rather than visibly on top of them.
          [...ASSESSMENT_TIMELINE_SERIES]
            .sort((a, b) => data[0][b.key] - data[0][a.key])
            .map((s) => (
              <ReferenceArea
                key={`fill-${s.key}`}
                x2={data[0].label}
                y1={0}
                y2={data[0][s.key]}
                fill={s.color}
                fillOpacity={fillOpacity}
                stroke="none"
                ifOverflow="visible"
              />
            ))}
        {ASSESSMENT_TIMELINE_SERIES.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={singleMonth ? "transparent" : s.color}
            fillOpacity={singleMonth ? 0 : fillOpacity}
            dot={
              singleMonth
                ? { r: 5, fill: s.color, fillOpacity: 1, stroke: "var(--surface-1)", strokeWidth: 2 }
                : { r: 3.5, fill: s.color, fillOpacity: 1, stroke: "var(--surface-1)", strokeWidth: 1.5 }
            }
            activeDot={{ r: 5.5, fill: s.color, fillOpacity: 1, stroke: "var(--surface-1)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Per-tool config for the "Current completion by assessment tool" bar
 * chart - the 4 real participant-level fields
 * `AssessmentToolStatusResponse` currently exposes (`sangian_participant`/
 * `vwm_participant`/`dccs_participant`/`cd_participant`). If REDCap ever
 * adds a 5th assessment tool, the backend schema (a fixed field per tool,
 * not a list) would need its own new field first - this array would then
 * gain one more literal entry to match, the same one-line extension the
 * page's prior 4-tool grid already required; the chart/legend/labels below
 * all render generically off this array's length, so nothing else changes. */
interface AssessmentToolConfig {
  key: string;
  label: string;
  tone: Tone;
  color: string;
}

const ASSESSMENT_TOOL_CONFIG: AssessmentToolConfig[] = [
  { key: "sangian", label: "SANGIAN", tone: "teal", color: "var(--series-3)" },
  { key: "vwm", label: "VWM", tone: "violet", color: "var(--series-violet)" },
  { key: "dccs", label: "DCCS", tone: "cyan", color: "var(--series-cyan)" },
  { key: "cd", label: "CD", tone: "amber", color: "var(--series-4)" },
];

interface AssessmentToolBarDatum {
  key: string;
  name: string;
  count: number;
  total: number;
  percent: number;
  color: string;
  value: number;
  remaining: number;
}

/** Custom two-line label ("count / total" bold, "pct%" tone-colored)
 * rendered just above each tool's real bar segment (not above the full
 * fixed-scale track), so the label's vertical position still correlates
 * with the tool's actual magnitude even though every bar is stacked to the
 * same 222-unit scale. */
function ToolBarLabel(props: { x?: string | number; y?: string | number; width?: string | number; index?: number; data: AssessmentToolBarDatum[] }) {
  const { x, y, width, index, data } = props;
  if (x === undefined || y === undefined || width === undefined || index === undefined) return null;
  const item = data[index];
  if (!item) return null;
  const numX = Number(x);
  const numY = Number(y);
  const numWidth = Number(width);
  const cx = numX + numWidth / 2;
  return (
    <g>
      <text x={cx} y={numY - 18} textAnchor="middle" className="ap-bar-label-count">
        {item.count} / {item.total}
      </text>
      <text x={cx} y={numY - 5} textAnchor="middle" className="ap-bar-label-percent" fill={item.color}>
        {item.percent}%
      </text>
    </g>
  );
}

/** "Current completion by assessment tool" - a vertical bar chart, one bar
 * per tool, each stacked as `value` (the real coloured segment) +
 * `remaining` (a faint `--gridline`-coloured segment filling the rest of a
 * fixed `total` scale) so every bar reads against the same denominator
 * track, per the reference spec's "faint full-height gray track" request -
 * implemented as a real stacked value, not a decorative overlay. */
function AssessmentToolBarChart({ data, denominator }: { data: AssessmentToolBarDatum[]; denominator: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 46, right: 8, left: 0, bottom: 4 }} barCategoryGap="32%">
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis
          domain={[0, denominator]}
          allowDecimals={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={34}
        />
        <RechartsTooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={(tooltipProps) => {
            const point = tooltipProps.payload?.[0]?.payload as AssessmentToolBarDatum | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={tooltipProps.active}
                title={point.name}
                rows={[
                  { label: "Completed", value: point.count.toLocaleString() },
                  { label: "Total", value: point.total.toLocaleString() },
                  { label: "Completion %", value: `${point.percent}%` },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="value" stackId="tool" radius={[0, 0, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          {data.map((item) => (
            <Cell key={item.key} fill={item.color} />
          ))}
          <LabelList dataKey="value" content={(labelProps) => <ToolBarLabel {...labelProps} data={data} />} />
        </Bar>
        <Bar dataKey="remaining" stackId="tool" radius={[0, 0, 0, 0]} maxBarSize={56} fill="var(--gridline)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function remainingCoreLabels(child: RegistryChild, coreBatteryColumns: { key: string; label: string }[]): string[] {
  return coreBatteryColumns.filter((col) => !child.instrument_status[col.key]).map((col) => col.label);
}

const CORE_BATTERY_KEYS = ["ses", "dseq", "child_illness_history", "paq_a", "dietary_intake", "ssrs_parent"];
const CORE_BATTERY_COLUMNS = INSTRUMENT_COLUMNS.filter((col) => CORE_BATTERY_KEYS.includes(col.key));

/** "Remaining Core Assessments" drawer - opened from the Core Assessment
 * Completion strip figure. Unchanged from the prior version: fetches the
 * same Registry data the Participants page already uses
 * (`core_battery_complete=false`), then reads each child's own
 * `instrument_status` for the 6 core instruments - no new backend
 * endpoint, no new completion definition. */
function CoreRemainingDrawer({
  isOpen,
  onClose,
  totalRegistered,
  coreCompleteCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  totalRegistered: number;
  coreCompleteCount: number;
}) {
  const [children, setChildren] = useState<RegistryChild[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState("all");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setLoadError(null);
    getRegistry({ coreBatteryComplete: false, limit: 500 })
      .then((res) => setChildren(res.children))
      .catch((err: Error) => setLoadError(err.message));
  }, [isOpen, retryToken]);

  const rows = (children ?? [])
    .map((child) => ({ child, remaining: remainingCoreLabels(child, CORE_BATTERY_COLUMNS) }))
    .filter((row) => row.remaining.length > 0);

  const filteredRows = rows.filter(({ child, remaining }) => {
    const q = query.trim().toLowerCase();
    if (q && !child.redcap_child_id.toLowerCase().includes(q)) return false;
    if (instrumentFilter !== "all") {
      const col = CORE_BATTERY_COLUMNS.find((c) => c.key === instrumentFilter);
      if (!col || !remaining.includes(col.label)) return false;
    }
    return true;
  });

  if (!isOpen) return null;

  const remainingCount = totalRegistered - coreCompleteCount;

  return (
    <div className="core-remaining-overlay" onClick={onClose}>
      <div className="core-remaining-panel" onClick={(e) => e.stopPropagation()}>
        <div className="core-remaining-header">
          <div>
            <div className="core-remaining-title">Remaining Core Assessments</div>
            <div className="core-remaining-summary">
              {remainingCount} / {totalRegistered} participants remaining
            </div>
          </div>
          <button type="button" className="registry-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ats-pstatus-controls">
          <input
            type="text"
            className="ats-pstatus-search"
            placeholder="Search Child ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search Child ID"
          />
          <select
            className="ats-pstatus-filter"
            value={instrumentFilter}
            onChange={(e) => setInstrumentFilter(e.target.value)}
            aria-label="Filter by remaining instrument"
          >
            <option value="all">Any remaining instrument</option>
            {CORE_BATTERY_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
        </div>

        {loadError && <DataLoadError message={loadError} onRetry={() => setRetryToken((t) => t + 1)} />}
        {!loadError && !children && <p className="ats-pstatus-empty">Loading participant status...</p>}
        {!loadError && children && (
          <div className="ats-pstatus-table-wrap">
            <table className="ats-pstatus-table core-remaining-table">
              <thead>
                <tr>
                  <th className="ats-pstatus-id-col">Participant ID</th>
                  <th>Remaining Forms / Assessments</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ child, remaining }) => (
                  <tr key={child.redcap_child_id}>
                    <td className="ats-pstatus-id-cell">{child.redcap_child_id}</td>
                    <td className="core-remaining-forms-cell">{remaining.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && <p className="ats-pstatus-empty">No participants match this search/filter.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [assessmentToolStatus, setAssessmentToolStatus] = useState<AssessmentToolStatusResponse | null>(null);
  const [assessmentTimeline, setAssessmentTimeline] = useState<AssessmentTimelineResponse | null>(null);
  const [screenTime, setScreenTime] = useState<ScreenTimeResponse | null>(null);
  const [health, setHealth] = useState<HealthScreeningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
    // Secondary sections - a failure on any of these must not block or
    // break the rest of the hub page, so each is fetched/caught
    // independently and simply doesn't render its card if unavailable.
    getAssessmentToolStatus()
      .then(setAssessmentToolStatus)
      .catch(() => setAssessmentToolStatus(null));
    // The Logging-API-backed timeline is its own fetch, separate from
    // assessmentToolStatus above - a REDCap Logging-permission failure (or
    // any other error) here must not affect the rest of Overview; the
    // trend panel simply falls back to its "unavailable" state (see the
    // Assessment Progress panel JSX below).
    getAssessmentTimeline()
      .then(setAssessmentTimeline)
      .catch(() => setAssessmentTimeline(null));
    getScreenTime()
      .then(setScreenTime)
      .catch(() => setScreenTime(null));
    getHealthScreening()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!overview) return <FullScreenLoader message="Loading ICMR Neurodevelopment Study Dashboard..." />;

  const findCoverage = (key: string) => overview.all_instrument_coverage.find((c) => c.key === key);

  /* 2026-09-28 senior requirement, corrected same day: every number/percent
   * displayed anywhere on this Dashboard now uses the overall study cohort
   * (222, `STUDY_ORIGINAL_ENROLLMENT`) as its denominator - not
   * `overview.total_registered` (212, the current live-REDCap registered/
   * active population), which is intentionally never read or shown on
   * this page anymore. This is a display-only change: every numerator
   * (completed_count, done_count, etc.) is still the real, live REDCap
   * value; only which number it's divided/shown against changed. Other
   * pages (Registry, Data Quality, the dedicated Assessment Tool Status
   * page, Demographics, etc.) are untouched and still correctly show the
   * real 212 registered/active population where that is the relevant
   * figure for their own purpose. */
  const studyDenominator = STUDY_ORIGINAL_ENROLLMENT;

  const simpleCoreModuleDefs: { key: string; label: string; tone: Tone; linkTo?: string }[] = [
    { key: "ses", label: "SES", tone: "teal" },
    { key: "child_illness_history", label: "Child Health History", tone: "blue", linkTo: "/health-screening" },
    { key: "dseq", label: "DSEQ / Screen Time", tone: "violet", linkTo: "/screen-time" },
    { key: "paq_a", label: "PAQ / Physical Activity", tone: "cyan" },
    { key: "dietary_intake", label: "Dietary Intake", tone: "amber" },
  ];
  const simpleCoreModules: PipelineNodeData[] = simpleCoreModuleDefs.map((def) => {
    const coverage = findCoverage(def.key);
    return { key: def.key, label: def.label, count: coverage?.completed_count ?? 0, total: studyDenominator, tone: def.tone, linkTo: def.linkTo };
  });

  /* SSRS consolidated into one module (2026-09-28) - Parent/Child/Teacher
   * are shown as a breakdown inside a single card, never as three separate
   * grid cells, per explicit instruction. */
  const ssrsModule: PipelineNodeData = {
    key: "ssrs",
    label: "SSRS",
    count: findCoverage("ssrs_parent")?.completed_count ?? 0,
    total: studyDenominator,
    tone: "pink",
    breakdown: [
      { label: "Parent", count: findCoverage("ssrs_parent")?.completed_count ?? 0 },
      { label: "Child", count: findCoverage("ssrs_child")?.completed_count ?? 0 },
      { label: "Teacher", count: findCoverage("ssrs_teacher")?.completed_count ?? 0 },
    ],
  };

  const coreModules: PipelineNodeData[] = [...simpleCoreModules, ssrsModule];

  const sexData = [
    { label: "Male", count: overview.sex_distribution.male },
    { label: "Female", count: overview.sex_distribution.female },
    { label: "Unknown", count: overview.sex_distribution.unknown },
  ].filter((d) => d.count > 0);
  const sexTotal = sexData.reduce((s, d) => s + d.count, 0);

  const ageData = overview.age_distribution.filter((b) => b.count > 0);
  const dominantAge = [...ageData].sort((a, b) => b.count - a.count)[0];
  const ageTotal = ageData.reduce((s, d) => s + d.count, 0);

  const sesCoverage = findCoverage("ses");

  return (
    <section className="overview-page">
      {/* --- 1. Top KPI strip (2026-09-28: "Original Cohort" card removed;
          2026-09-28 correction (same day): every displayed number/percent
          on this Dashboard now uses the overall study cohort (222,
          `studyDenominator`) as its denominator - `overview.total_
          registered` (212) is intentionally never read on this page
          anymore. Percentages that the API computed against 212
          (`assessmentToolStatus.overall_participant.percent`, `overview
          .core_assessment_percent`) are recomputed here with
          `percentOf(count, studyDenominator)` rather than used as-is, so
          no 212-denominated percent survives either. --- */}
      <div className="stat-strip">
        <div className="stat-block">
          <span className="stat-block-label">Current Active Cases</span>
          <span className="stat-block-value">{studyDenominator.toLocaleString()}</span>
          <span className="stat-block-footnote">Overall study cohort</span>
        </div>
        <div className="stat-block">
          <span className="stat-block-label">Assessment Progress</span>
          <span className="stat-block-value">
            {assessmentToolStatus ? `${assessmentToolStatus.overall_participant.done_count} / ${studyDenominator}` : "—"}
          </span>
          {assessmentToolStatus && (
            <MonitorBar percent={percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)} tone="violet" />
          )}
          {assessmentToolStatus && (
            <span className="stat-block-footnote">{percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)}%</span>
          )}
        </div>
        <button type="button" className="stat-block stat-block-clickable" onClick={() => setRemainingOpen(true)}>
          <span className="stat-block-label">Core Assessment Completion</span>
          <span className="stat-block-value">
            {overview.core_assessment_count} / {studyDenominator}
          </span>
          <MonitorBar percent={percentOf(overview.core_assessment_count, studyDenominator)} tone="amber" />
          <span className="stat-block-footnote">{percentOf(overview.core_assessment_count, studyDenominator)}% · View remaining →</span>
        </button>
      </div>

      <CoreRemainingDrawer
        isOpen={remainingOpen}
        onClose={() => setRemainingOpen(false)}
        totalRegistered={studyDenominator}
        coreCompleteCount={overview.core_assessment_count}
      />

      {/* --- 2. Study Progress - animated connected pipeline --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Study Progress</span>
          <span className="monitor-section-note">Registration → parallel core modules → assessment tools</span>
        </div>
        <StudyProgressPipeline
          registration={{
            key: "registration",
            label: "Registration / Cohort",
            /* Per the explicit senior example ("Registration / Cohort →
             * 222/222"), this node represents whole-cohort enrollment
             * itself, so its count is the same overall-cohort figure as
             * its denominator - not the live registration-form completion
             * count (212), which would otherwise reintroduce a visible
             * "212" here. */
            count: studyDenominator,
            total: studyDenominator,
            tone: "blue",
          }}
          coreModules={coreModules}
          assessmentTools={
            assessmentToolStatus
              ? {
                  key: "assessment_tools",
                  label: "Assessment Tools",
                  count: assessmentToolStatus.overall_participant.done_count,
                  total: studyDenominator,
                  tone: "cyan",
                }
              : null
          }
        />
      </div>

      {/* --- 3. Key Study Modules - pixel-target restyle (2026-09-28) via
          `ModuleCard`/`ModuleCompletionDonut`/`DonutRing`/`IndicatorRow`/
          `DayTypeRow` - a self-contained panel/card design (see the
          `.key-modules-panel` CSS block) matching a supplied mockup for
          style only. Every value below is still read live from
          `screenTime`/`health`/`studyDenominator` - no figure is
          hardcoded, and every percent is computed via `percentOf()`. --- */}
      <section className="key-modules-panel">
        <div className="kmp-panel-header">
          <span className="kmp-panel-title">Key Study Modules</span>
          <span className="kmp-panel-subtitle">Featured modules - full analysis on their own page</span>
        </div>
        <div className="kmp-grid">
          <ModuleCard
            to="/screen-time"
            tone="violet"
            icon={<IconMonitor width={26} height={26} />}
            title="DSEQ / Screen Time"
            description="Digital Screen Exposure Questionnaire - screen time, physical activity, media behaviour."
            footerIcon={<IconDocument width={16} height={16} />}
            footerLabel="View DSEQ"
          >
            {screenTime ? (
              <>
                <div className="kmp-donut-col">
                  <ModuleCompletionDonut count={screenTime.completion.completed} total={studyDenominator} label="DSEQ" />
                </div>
                <div className="kmp-divider" />
                <div className="kmp-detail-col">
                  <span className="kmp-detail-label kmp-detail-label-dseq">Average daily screen time</span>
                  {screenTime.average_daily_summary.mean !== null ? (
                    <div className="kmp-headline-row">
                      <span className="kmp-headline-icon">
                        <IconClock width={18} height={18} />
                      </span>
                      <span className="kmp-headline-value">{Math.round(screenTime.average_daily_summary.mean)} min</span>
                      <span className="kmp-headline-muted">(est.)</span>
                    </div>
                  ) : (
                    <p className="module-indicator">No data</p>
                  )}
                  {screenTime.school_day_summary.mean !== null && screenTime.weekend_summary.mean !== null && (
                    <div className="kmp-day-panel">
                      <span className="kmp-day-panel-title">Screen time by day type</span>
                      <DayTypeRow icon={<IconBuilding width={15} height={15} />} label="School-day" minutes={screenTime.school_day_summary.mean} maxMinutes={90} tone="violet" />
                      <DayTypeRow icon={<IconHome width={15} height={15} />} label="Weekend" minutes={screenTime.weekend_summary.mean} maxMinutes={90} tone="violet" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="module-indicator">Data unavailable</p>
            )}
          </ModuleCard>

          <ModuleCard
            to="/health-screening"
            tone="blue"
            icon={<IconHeart width={26} height={26} />}
            title="Child Health History"
            description="Baseline health and illness history - current health, chronic/neurological history, assessment readiness."
            footerIcon={<IconExternalLink width={16} height={16} />}
            footerLabel="View Child Health"
          >
            {health ? (
              <>
                <div className="kmp-donut-col">
                  <ModuleCompletionDonut count={health.completion.completed} total={studyDenominator} label="Child Health History" />
                </div>
                <div className="kmp-divider" />
                <div className="kmp-detail-col">
                  <span className="kmp-detail-label">Key indicators</span>
                  <div className="kmp-indicator-rows">
                    <IndicatorRow
                      icon={<IconDocument width={17} height={17} />}
                      label="Current illness"
                      count={health.chh.current_health.currently_ill.yes_count}
                      total={health.chh.current_health.currently_ill.valid_n}
                    />
                    <IndicatorRow
                      icon={<IconBrain width={17} height={17} />}
                      label="Chronic / neurological"
                      count={health.chh.chronic_illness.any_listed_condition.yes_count}
                      total={health.chh.chronic_illness.any_listed_condition.valid_n}
                      tone="amber"
                    />
                    <IndicatorRow
                      icon={<IconPulse width={17} height={17} />}
                      label="Neurological history"
                      count={health.chh.neurological.any_neurological_history.yes_count}
                      total={health.chh.neurological.any_neurological_history.valid_n}
                      tone="pink"
                    />
                    <IndicatorRow
                      icon={<IconClipboardCheck width={17} height={17} />}
                      label="Assessment readiness concern"
                      count={health.chh.assessment_day.any_assessment_day_concern_count}
                      total={health.chh.assessment_day.any_assessment_day_concern_total}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="module-indicator">Data unavailable</p>
            )}
          </ModuleCard>
        </div>
      </section>

      {/* --- 4. Assessment Progress panel (2026-09-29 rebuild) - a
          bordered outer frame with a tinted overall-completion band, a
          trend-panel/bar-chart row, and a clickable footer link. See the
          `AssessmentToolBarChart`/`ASSESSMENT_TOOL_CONFIG` block above for
          why the left panel is an explicit "unavailable" state rather than
          a fabricated time series. --- */}
      {assessmentToolStatus && (
        <section className="ap-panel">
          <div className="ap-panel-header">
            <span className="ap-panel-title">Assessment Progress</span>
            <span className="ap-panel-subtitle">Administration status only - not outcome data</span>
          </div>

          <div className="ap-overall-band monitor-tone-blue">
            <div className="ap-overall-left">
              <span className="ap-overall-icon">
                <IconProgress width={24} height={24} />
              </span>
              <div>
                <span className="ap-overall-label">Overall Assessment</span>
                <span className="ap-overall-value">
                  {assessmentToolStatus.overall_participant.done_count} / {studyDenominator}
                </span>
              </div>
            </div>
            <div className="ap-overall-right">
              <MonitorBar percent={percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)} tone="blue" />
              <span className="ap-overall-percent">{percentOf(assessmentToolStatus.overall_participant.done_count, studyDenominator)}%</span>
            </div>
          </div>

          <div className="ap-bottom-grid">
            <div className="ap-trend-panel">
              <div className="ap-panel-title-block">
                <span className="ap-panel-block-title">Cumulative assessments recorded over time</span>
                <p className="ap-panel-block-subtitle">Recorded assessment completion status over time</p>
              </div>
              {assessmentTimeline && assessmentTimeline.available && assessmentTimeline.reconciled && assessmentTimeline.series.length > 0 ? (
                <>
                  <AssessmentTimelineChart series={assessmentTimeline.series} />
                  <p className="ap-trend-note">
                    {assessmentTimeline.note}
                    {assessmentTimeline.series.length === 1 &&
                      " Only one month of recorded history exists so far - the trend will show more detail as further months are logged."}
                  </p>
                </>
              ) : (
                <div className="ap-trend-unavailable">
                  <IconCalendar width={22} height={22} />
                  <p className="ap-trend-unavailable-title">Assessment timeline unavailable</p>
                  <p className="ap-trend-unavailable-text">
                    {assessmentTimeline && assessmentTimeline.available && !assessmentTimeline.reconciled
                      ? "The recorded history for one or more tools does not currently reconcile with live REDCap data, so it is not shown rather than risk displaying an incorrect chart."
                      : "REDCap's Assessment Tool Status instrument records only a Done / Not Done status for SANGIAN, VWM, DCCS, and CD Task, and no change history is available right now to reconstruct a timeline from."}
                  </p>
                </div>
              )}
            </div>

            <div className="ap-divider" />

            <div className="ap-tools-panel">
              <div className="ap-panel-title-block">
                <span className="ap-panel-block-title">Current completion by assessment tool</span>
                <p className="ap-panel-block-subtitle">Number and percentage of children completed</p>
              </div>
              {(() => {
                const participantByKey: Record<string, { done_count: number; total: number; percent: number }> = {
                  sangian: assessmentToolStatus.sangian_participant,
                  vwm: assessmentToolStatus.vwm_participant,
                  dccs: assessmentToolStatus.dccs_participant,
                  cd: assessmentToolStatus.cd_participant,
                };
                const barData: AssessmentToolBarDatum[] = ASSESSMENT_TOOL_CONFIG.map((tool) => {
                  const count = participantByKey[tool.key].done_count;
                  const percent = percentOf(count, studyDenominator);
                  return {
                    key: tool.key,
                    name: tool.label,
                    count,
                    total: studyDenominator,
                    percent,
                    color: tool.color,
                    value: count,
                    remaining: Math.max(0, studyDenominator - count),
                  };
                });
                return <AssessmentToolBarChart data={barData} denominator={studyDenominator} />;
              })()}
            </div>
          </div>

          <Link to="/assessment-tool-status" className="ap-footer">
            <span className="ap-footer-icon">
              <IconChart width={16} height={16} />
            </span>
            <span className="ap-footer-label">View Assessment Details →</span>
            <IconChevron className="ap-footer-chevron" width={16} height={16} />
          </Link>
        </section>
      )}

      {/* --- 5. Study Snapshot - three compact infographic blocks
          (2026-09-28 redesign): Sex Distribution (split bar), Age Profile
          (per-bucket mini bars), SES Coverage (dominant figure + bar) - a
          3-column layout instead of a stacked full-width text list. --- */}
      <div className="monitor-section">
        <div className="monitor-section-head">
          <span className="monitor-section-title">Study Snapshot</span>
          <span className="monitor-section-note">Who is registered in the study</span>
        </div>
        <div className="snapshot-infographic-grid">
          <div className="snapshot-block monitor-tone-blue">
            <div className="snapshot-block-head">
              <IconUsers width={14} height={14} />
              <span className="snapshot-block-title">Sex Distribution</span>
            </div>
            <SplitBar segments={sexData.map((d) => ({ tone: sexTone(d.label), percent: percentOf(d.count, sexTotal) }))} />
            <div className="split-bar-legend">
              {sexData.map((d) => (
                <span key={d.label} className="split-bar-legend-item">
                  <span className={`split-bar-legend-dot monitor-tone-${sexTone(d.label)}`} />
                  {d.label} {percentOf(d.count, sexTotal)}%
                </span>
              ))}
            </div>
          </div>

          <div className="snapshot-block monitor-tone-violet">
            <div className="snapshot-block-head">
              <IconCalendar width={14} height={14} />
              <span className="snapshot-block-title">Age Profile</span>
            </div>
            <div className="snapshot-age-list">
              {ageData.map((bucket) => {
                const percent = percentOf(bucket.count, ageTotal);
                const isDominant = dominantAge?.label === bucket.label;
                return (
                  <div key={bucket.label} className="snapshot-age-row">
                    <div className="module-indicator-row">
                      <span className={`module-indicator-label${isDominant ? " snapshot-age-label-dominant" : ""}`}>{bucket.label}</span>
                      <span className="module-indicator-value">{percent}%</span>
                    </div>
                    <MonitorBar percent={percent} tone={isDominant ? "violet" : "blue"} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="snapshot-block monitor-tone-teal">
            <div className="snapshot-block-head">
              <IconChart width={14} height={14} />
              <span className="snapshot-block-title">SES Coverage</span>
            </div>
            {sesCoverage ? (
              <>
                <span className="snapshot-ses-value">
                  {sesCoverage.completed_count} / {studyDenominator}
                </span>
                <MonitorBar percent={percentOf(sesCoverage.completed_count, studyDenominator)} tone="teal" />
                <span className="snapshot-ses-percent">{percentOf(sesCoverage.completed_count, studyDenominator)}% instrument completion</span>
              </>
            ) : (
              <p className="module-indicator">No data</p>
            )}
          </div>
        </div>
        <Link to="/demographics" className="monitor-detail-link">
          View Demographics →
        </Link>
      </div>
    </section>
  );
}
