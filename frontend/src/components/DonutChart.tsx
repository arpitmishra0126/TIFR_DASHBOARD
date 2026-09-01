import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const CATEGORICAL_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];

export interface DonutDatum {
  label: string;
  count: number;
}

interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
}

export default function DonutChart({ data, height = 160 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="donut-chart">
      <ResponsiveContainer width={height} height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-hairline-strong)",
              borderRadius: 10,
              boxShadow: "var(--shadow-card-hover)",
              fontSize: 12,
              padding: "8px 12px",
              color: "var(--text-primary)",
            }}
            formatter={((value: number, name: string) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return [`${value} (${pct}%)`, name];
            }) as (value: unknown, name: unknown) => [string, string]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-legend">
        {data.map((entry, index) => (
          <div key={entry.label} className="donut-legend-item">
            <span
              className="donut-legend-dot"
              style={{ background: CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length] }}
            />
            <span className="donut-legend-label">{entry.label}</span>
            <span className="donut-legend-value">
              {entry.count} ({total > 0 ? Math.round((entry.count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
