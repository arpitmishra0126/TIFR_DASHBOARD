import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";

import { ChartTooltipBox } from "./charts/ChartTooltip";
import { percentOf } from "./charts/chartHelpers";

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
  /** Optional center figure — defaults to the sum of `data`, i.e. no new
   * value is introduced, only a display choice of what to foreground. */
  centerValue?: string | number;
  centerLabel?: string;
}

function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
      />
    </g>
  );
}

export default function DonutChart({ data, height = 200, centerValue, centerLabel }: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="donut-chart">
      <div className="donut-plot" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={4}
              strokeWidth={0}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                const point = props.payload?.[0]?.payload as DonutDatum | undefined;
                if (!point) return null;
                return (
                  <ChartTooltipBox
                    active={props.active}
                    title={point.label}
                    rows={[
                      { label: "n", value: point.count.toLocaleString() },
                      { label: "%", value: `${percentOf(point.count, total)}%` },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <div className="donut-center-value">{(centerValue ?? total).toLocaleString()}</div>
          {centerLabel && <div className="donut-center-label">{centerLabel}</div>}
        </div>
      </div>
      <div className="donut-legend">
        {data.map((entry, index) => (
          <div
            key={entry.label}
            className={`donut-legend-item${activeIndex === index ? " active" : ""}`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
          >
            <span className="donut-legend-heading">
              <span
                className="donut-legend-dot"
                style={{ background: CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length] }}
              />
              <span className="donut-legend-label">{entry.label}</span>
            </span>
            <span className="donut-legend-value">
              {entry.count.toLocaleString()}
              <span className="donut-legend-percent">{percentOf(entry.count, total)}%</span>
            </span>
            <span className="donut-legend-bar">
              <span
                className="donut-legend-bar-fill"
                style={{
                  width: `${percentOf(entry.count, total)}%`,
                  background: CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length],
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
