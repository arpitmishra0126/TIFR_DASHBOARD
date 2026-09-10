import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox } from "./charts/ChartTooltip";
import { percentOf, sequentialOpacity, wrapLabel } from "./charts/chartHelpers";

const CATEGORICAL_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];

const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 16;
const DEFAULT_ROW_HEIGHT = 44;
// Conservative average glyph width (px) at LABEL_FONT_SIZE - deliberately an
// underestimate so wrapping triggers a little early rather than letting a
// long label overflow the reserved axis width into the bars.
const AVG_CHAR_PX = 6;

// Chart geometry, normal vs. `dense`. `dense` is opt-in (default false, so
// every existing caller - Overview/Demographics' SES charts - is byte-for-
// byte unchanged) - use it for a group of many small, information-dense
// charts (e.g. Dietary Intake's 10 food-group charts) that need thinner,
// less-rounded bars and a tighter plot area rather than the default
// spacious layout. Category order, data, and category count are untouched
// by this - it only affects pixel geometry.
const GEOMETRY = {
  normal: {
    rowHeight: DEFAULT_ROW_HEIGHT,
    lineHeight: LABEL_LINE_HEIGHT,
    tickFontSize: LABEL_FONT_SIZE,
    barSize: 26,
    barRadius: [0, 7, 7, 0] as [number, number, number, number],
    categoryGap: "30%",
    margin: { top: 4, right: 68, left: 0, bottom: 4 },
    minHeight: 150,
  },
  dense: {
    rowHeight: 28,
    lineHeight: 13,
    tickFontSize: 11,
    barSize: 16,
    barRadius: [0, 3, 3, 0] as [number, number, number, number],
    categoryGap: "14%",
    margin: { top: 2, right: 58, left: 0, bottom: 2 },
    minHeight: 110,
  },
};

export interface CategoryBarDatum {
  label: string;
  count: number;
}

interface HorizontalBarChartProps {
  data: CategoryBarDatum[];
  height?: number;
  mode?: "categorical" | "sequential";
  /** Y-axis category column width in px. Widen this for long REDCap choice
   * labels (e.g. Dietary Intake's Hindi frequency categories) instead of
   * hacking margins per chart - labels still wrap onto multiple lines
   * within this width rather than overflowing into the bars. */
  labelWidth?: number;
  /** Thinner bars, smaller corner radius, tighter margins/row height - see
   * GEOMETRY above. Default false (unchanged existing look). */
  dense?: boolean;
}

function maxWrappedLines(data: CategoryBarDatum[], labelWidth: number): number {
  const maxChars = Math.max(6, Math.floor((labelWidth - 10) / AVG_CHAR_PX));
  return Math.max(1, ...data.map((d) => wrapLabel(d.label, maxChars).length));
}

/** Height for one chart's row count/label-wrap depth at a given
 * `labelWidth`. Exported so a page rendering several of these charts side
 * by side (e.g. Dietary Intake's 10 food-group charts) can compute one
 * shared height across every dataset up front and pass it to each chart -
 * keeping every chart in the group the same size instead of each sizing
 * itself independently off its own row/wrap count. */
export function computeHorizontalBarChartHeight(datasets: CategoryBarDatum[][], labelWidth = 124, dense = false): number {
  const geo = dense ? GEOMETRY.dense : GEOMETRY.normal;
  let maxRows = 1;
  let sharedMaxLines = 1;
  for (const data of datasets) {
    maxRows = Math.max(maxRows, data.length);
    sharedMaxLines = Math.max(sharedMaxLines, maxWrappedLines(data, labelWidth));
  }
  const rowHeight = geo.rowHeight + (sharedMaxLines - 1) * geo.lineHeight;
  return Math.max(geo.minHeight, maxRows * rowHeight);
}

/** Custom Y-axis tick that word-wraps a category label to fit `width`,
 * instead of recharts' default single-line tick (which lets long labels
 * overflow past the reserved axis width and collide with the bars). Never
 * truncates - a label that needs more lines simply gets them.
 *
 * `lineHeight`/`fontSize` MUST match the same values used to size each
 * category's row (see GEOMETRY/computeHorizontalBarChartHeight) - recharts
 * centers `y` on the row's own vertical midpoint for us, but a wrapped
 * multi-line label is drawn by hand via <tspan> dy offsets around that
 * midpoint, so if this line-height doesn't match the spacing the row was
 * actually sized for, a multi-line label's text block no longer fits its
 * row and visually spills into the neighboring row - reading as a label
 * misaligned with (or "between") bars, even though the anchor point
 * itself was correct. This is why `dense` mode cannot reuse the `normal`
 * mode's hardcoded 16px/12px - it has its own tighter row height. */
function makeCategoryTick(width: number, lineHeight: number, fontSize: number) {
  const maxChars = Math.max(6, Math.floor((width - 10) / AVG_CHAR_PX));
  return function CategoryTick({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) {
    const lines = wrapLabel(payload.value, maxChars);
    const startDy = -((lines.length - 1) / 2) * lineHeight;
    return (
      <text
        x={x}
        y={y}
        dominantBaseline="central"
        textAnchor="end"
        fontSize={fontSize}
        fontWeight={600}
        fill="var(--text-secondary)"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
}

export default function HorizontalBarChart({ data, height, mode = "categorical", labelWidth = 124, dense = false }: HorizontalBarChartProps) {
  const geo = dense ? GEOMETRY.dense : GEOMETRY.normal;
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const rowHeight = geo.rowHeight + (maxWrappedLines(data, labelWidth) - 1) * geo.lineHeight;
  const resolvedHeight = height ?? Math.max(geo.minHeight, data.length * rowHeight);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  // Stable across hover-only re-renders (activeIndex changing below) -
  // without this, `tick` gets a new component identity on every render,
  // so Recharts remounts the Y-axis tick nodes on every mouse move.
  const categoryTick = useMemo(
    () => makeCategoryTick(labelWidth, geo.lineHeight, geo.tickFontSize),
    [labelWidth, geo.lineHeight, geo.tickFontSize],
  );

  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={geo.margin}
        barCategoryGap={geo.categoryGap}
      >
        <CartesianGrid horizontal={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={categoryTick}
          axisLine={false}
          tickLine={false}
          width={labelWidth}
          // Recharts' default category-axis `interval` ("preserveEnd")
          // silently drops ticks it estimates would collide, using its own
          // generic size guess rather than our actual (compact) custom
          // tick renderer - at `dense` mode's tighter row height it was
          // dropping up to half the categories (confirmed via DOM
          // inspection: only 4 of 8 tick groups rendered for some food
          // groups), which is what produced the reported "label between
          // bars" misalignment - a genuinely rendered bar with no visible
          // tick of its own nearby, not a coordinate math bug. `interval={0}`
          // forces every category to always get its own tick, in both
          // modes - every category must always be labeled, so this is not
          // dense-specific.
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={(props) => {
            const point = props.payload?.[0]?.payload as CategoryBarDatum | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={props.active}
                title={point.label}
                rows={[
                  { label: "n", value: point.count.toLocaleString() },
                  { label: "Share", value: `${percentOf(point.count, total)}%` },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="count"
          radius={geo.barRadius}
          maxBarSize={geo.barSize}
          isAnimationActive={false}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(undefined)}
        >
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            style={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 700 }}
            formatter={(label) => {
              const value = Number(label);
              return Number.isFinite(value) ? `${value.toLocaleString()} (${percentOf(value, total)}%)` : "";
            }}
          />
          {data.map((entry, index) => {
            const isActive = activeIndex === index;
            const baseFill = mode === "categorical" ? CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length] : "var(--series-1)";
            const opacity = mode === "sequential" ? sequentialOpacity(entry.count, maxCount) : 1;
            return (
              <Cell
                key={entry.label}
                fill={baseFill}
                fillOpacity={isActive ? 1 : opacity}
                stroke={isActive ? baseFill : "transparent"}
                strokeWidth={isActive ? 1.5 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
