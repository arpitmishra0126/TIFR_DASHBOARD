import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import type { ScreenActivityPoint } from "../../types/liveDashboard";
import { ChartTooltipBox } from "./ChartTooltip";

interface ScreenActivityScatterProps {
  data: ScreenActivityPoint[];
  height?: number;
}

export default function ScreenActivityScatter({ data, height = 260 }: ScreenActivityScatterProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          dataKey="screen_minutes"
          name="Screen time"
          tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          label={{
            value: "Estimated screen time (min/day)",
            position: "insideBottom",
            offset: -2,
            fill: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 600,
          }}
        />
        <YAxis
          type="number"
          dataKey="activity_minutes"
          name="Outdoor play"
          tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={44}
          label={{
            value: "Outdoor play (min/day)",
            angle: -90,
            position: "insideLeft",
            fill: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 600,
          }}
        />
        <ZAxis range={[70, 70]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "var(--baseline)" }}
          content={(props) => {
            const point = props.payload?.[0]?.payload as ScreenActivityPoint | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={props.active}
                title="Child (one point)"
                rows={[
                  { label: "Screen time", value: `${point.screen_minutes} min/day (est.)` },
                  { label: "Outdoor activity", value: `${point.activity_minutes} min/day (est.)` },
                ]}
              />
            );
          }}
        />
        <Scatter data={data} fill="var(--series-1)" fillOpacity={0.65} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
