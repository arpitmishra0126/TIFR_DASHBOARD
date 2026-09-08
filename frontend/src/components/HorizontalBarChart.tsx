import { useState } from "react";
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
export function computeHorizontalBarChartHeight(datasets: CategoryBarDatum[][], labelWidth = 124): number {
  let maxRows = 1;
  let sharedMaxLines = 1;
  for (const data of datasets) {
    maxRows = Math.max(maxRows, data.length);
    sharedMaxLines = Math.max(sharedMaxLines, maxWrappedLines(data, labelWidth));
  }
  const rowHeight = DEFAULT_ROW_HEIGHT + (sharedMaxLines - 1) * LABEL_LINE_HEIGHT;
  return Math.max(150, maxRows * rowHeight);
}

/** Custom Y-axis tick that word-wraps a category label to fit `width`,
 * instead of recharts' default single-line tick (which lets long labels
 * overflow past the reserved axis width and collide with the bars). Never
 * truncates - a label that needs more lines simply gets them. */
function makeCategoryTick(width: number) {
  const maxChars = Math.max(6, Math.floor((width - 10) / AVG_CHAR_PX));
  return function CategoryTick({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) {
    const lines = wrapLabel(payload.value, maxChars);
    const startDy = -((lines.length - 1) / 2) * LABEL_LINE_HEIGHT;
    return (
      <text x={x} y={y} textAnchor="end" fontSize={LABEL_FONT_SIZE} fontWeight={600} fill="var(--text-secondary)">
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : LABEL_LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
}

export default function HorizontalBarChart({ data, height, mode = "categorical", labelWidth = 124 }: HorizontalBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const rowHeight = DEFAULT_ROW_HEIGHT + (maxWrappedLines(data, labelWidth) - 1) * LABEL_LINE_HEIGHT;
  const resolvedHeight = height ?? Math.max(150, data.length * rowHeight);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 68, left: 0, bottom: 4 }}
        barCategoryGap="30%"
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
          tick={makeCategoryTick(labelWidth)}
          axisLine={false}
          tickLine={false}
          width={labelWidth}
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
          radius={[0, 7, 7, 0]}
          maxBarSize={26}
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
