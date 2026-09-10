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

const X_LABEL_LINE_HEIGHT = 13;
const X_LABEL_FONT_SIZE = 11;

export interface CategoryBarDatum {
  label: string;
  count: number;
}

interface CategoryBarChartProps {
  data: CategoryBarDatum[];
  mode: "categorical" | "sequential";
  height?: number;
  /** Optional: word-wrap each X-axis category label to at most this many
   * characters per line instead of the default single-line tick. Use for
   * charts whose category labels are long enough to collide at normal
   * width (e.g. a numeric-range histogram with many bins) - existing
   * callers that omit this prop keep the original single-line tick and
   * bottom margin unchanged. */
  xTickMaxChars?: number;
}

function makeWrappedXTick(maxChars: number) {
  return function WrappedXTick({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) {
    const lines = wrapLabel(payload.value, maxChars);
    const numY = typeof y === "number" ? y : Number(y);
    return (
      <text x={x} y={numY + 4} textAnchor="middle" fontSize={X_LABEL_FONT_SIZE} fontWeight={600} fill="var(--text-secondary)">
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 10 : X_LABEL_LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
}

export default function CategoryBarChart({ data, mode, height, xTickMaxChars }: CategoryBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const maxWrappedLines = xTickMaxChars
    ? Math.max(1, ...data.map((d) => wrapLabel(d.label, xTickMaxChars).length))
    : 1;
  const bottomMargin = xTickMaxChars ? 4 + (maxWrappedLines - 1) * X_LABEL_LINE_HEIGHT : 4;
  const resolvedHeight = height ?? (xTickMaxChars ? 220 + (maxWrappedLines - 1) * X_LABEL_LINE_HEIGHT : 220);
  // Stable across hover-only re-renders (activeIndex changing below) -
  // without this, `tick` gets a new component identity on every render,
  // so Recharts remounts the X-axis tick nodes on every mouse move.
  const wrappedXTick = useMemo(() => (xTickMaxChars ? makeWrappedXTick(xTickMaxChars) : undefined), [xTickMaxChars]);

  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: bottomMargin }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          dataKey="label"
          tick={wrappedXTick ?? { fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          interval={xTickMaxChars ? 0 : undefined}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
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
          radius={[7, 7, 0, 0]}
          maxBarSize={56}
          isAnimationActive={false}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(undefined)}
        >
          <LabelList
            dataKey="count"
            position="top"
            offset={8}
            style={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 700 }}
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
