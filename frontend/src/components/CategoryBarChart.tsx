import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
   *  "sequential": bars are ordered bins of one measure, single hue. */
  mode: "categorical" | "sequential";
  height?: number;
}

export default function CategoryBarChart({ data, mode, height = 220 }: CategoryBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-hairline-strong)",
            borderRadius: 10,
            boxShadow: "var(--shadow-card-hover)",
            fontSize: 12,
            padding: "8px 12px",
            color: "var(--text-primary)",
          }}
          labelStyle={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: 2 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={mode === "categorical" ? CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length] : "var(--series-1)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
