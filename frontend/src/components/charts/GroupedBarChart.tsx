import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox } from "./ChartTooltip";

const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

export interface GroupedBarSeries {
  key: string;
  label: string;
}

export interface GroupedBarDatum {
  group: string;
  /** value per series key; a missing/undefined value renders as no bar
   * segment for that series in that group rather than a fabricated 0. */
  values: Record<string, number | null | undefined>;
  /** optional per-series valid-N shown in the tooltip, keyed the same way. */
  validN?: Record<string, number | undefined>;
}

interface GroupedBarChartProps {
  data: GroupedBarDatum[];
  series: GroupedBarSeries[];
  stacked?: boolean;
  height?: number;
  unit?: string;
}

export default function GroupedBarChart({ data, series, stacked = false, height = 240, unit = "" }: GroupedBarChartProps) {
  const chartData = data.map((d) => {
    const row: Record<string, unknown> = { group: d.group };
    series.forEach((s) => {
      row[s.key] = d.values[s.key] ?? null;
      row[`${s.key}__validN`] = d.validN?.[s.key];
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 22, right: 8, left: 0, bottom: 4 }} barCategoryGap="24%" barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          dataKey="group"
          tick={{ fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={(props) => {
            const point = props.payload?.[0]?.payload as Record<string, unknown> | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={props.active}
                title={String(point.group)}
                rows={series.map((s) => {
                  const value = point[s.key] as number | null;
                  const validN = point[`${s.key}__validN`] as number | undefined;
                  return {
                    label: s.label,
                    value:
                      value === null || value === undefined
                        ? "No data"
                        : `${value.toLocaleString()}${unit}${validN !== undefined ? ` (n=${validN})` : ""}`,
                  };
                })}
              />
            );
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            radius={stacked ? [0, 0, 0, 0] : [6, 6, 0, 0]}
            maxBarSize={stacked ? 64 : 48}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
