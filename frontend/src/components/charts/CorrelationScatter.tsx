import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import type { SsrsAgreementPoint } from "../../types/liveDashboard";
import { ChartTooltipBox } from "./ChartTooltip";

interface CorrelationScatterProps {
  data: SsrsAgreementPoint[];
  xLabel: string;
  yLabel: string;
  height?: number;
}

/** Generic 0-100% x-vs-y scatter for comparing two respondents' Social
 * Skills scores (as a % of each respondent's own maximum) for the same
 * children. Child ID is shown only in the hover tooltip - never as an
 * always-visible axis label. */
export default function CorrelationScatter({ data, xLabel, yLabel, height = 240 }: CorrelationScatterProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          dataKey="a"
          domain={[0, 100]}
          tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          label={{ value: xLabel, position: "insideBottom", offset: -2, fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
        />
        <YAxis
          type="number"
          dataKey="b"
          domain={[0, 100]}
          tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={44}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
        />
        <ZAxis range={[70, 70]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "var(--baseline)" }}
          content={(props) => {
            const point = props.payload?.[0]?.payload as SsrsAgreementPoint | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={props.active}
                title={point.child_id}
                rows={[
                  { label: xLabel, value: `${point.a}%` },
                  { label: yLabel, value: `${point.b}%` },
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
