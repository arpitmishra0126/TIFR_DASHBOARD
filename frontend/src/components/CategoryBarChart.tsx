import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox } from "./charts/ChartTooltip";
import { percentOf, sequentialOpacity } from "./charts/chartHelpers";

const CATEGORICAL_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];

export interface CategoryBarDatum {
  label: string;
  count: number;
}

interface CategoryBarChartProps {
  data: CategoryBarDatum[];
  /** "categorical": each bar is a distinct identity, gets its own hue.
   *  "sequential": bars are ordered bins of one measure, single hue, shaded
   *  by relative magnitude for a subtle sense of hierarchy. */
  mode: "categorical" | "sequential";
  height?: number;
}

export default function CategoryBarChart({ data, mode, height = 220 }: CategoryBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
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
