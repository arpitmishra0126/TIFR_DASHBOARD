import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ConditionIndicator } from "../../types/liveDashboard";
import { ChartTooltipBox } from "./ChartTooltip";
import { percentOf } from "./chartHelpers";

interface ConditionCompositionChartProps {
  items: ConditionIndicator[];
  height?: number;
}

interface Row {
  label: string;
  yes: number;
  no: number;
  dontKnow: number;
  validN: number;
  askedN: number;
  percentYes: number;
  yesPct: number;
  noPct: number;
  dkPct: number;
  isZero: boolean;
}

/** 100%-stacked Yes / No / Don't-know composition, one row per condition or
 * indicator — the primary visual for Child Illness History items. Each
 * row's percentages are computed from that item's own `valid_n` (children
 * who actually answered that question), matching the backend's own
 * `percent_yes` denominator exactly — no new analytics, only chart-ready
 * derivations of numbers already returned by the API. Rows with zero "Yes"
 * responses are kept visible (never hidden) but rendered at reduced opacity
 * per the "subdued, not hidden" requirement for zero-prevalence conditions. */
export default function ConditionCompositionChart({ items, height }: ConditionCompositionChartProps) {
  const resolvedHeight = height ?? Math.max(170, items.length * 38);
  const data: Row[] = items.map((c) => ({
    label: c.label,
    yes: c.yes_count,
    no: c.no_count,
    dontKnow: c.dont_know_count,
    validN: c.valid_n,
    askedN: c.asked_n,
    percentYes: c.percent_yes,
    yesPct: percentOf(c.yes_count, c.valid_n),
    noPct: percentOf(c.no_count, c.valid_n),
    dkPct: percentOf(c.dont_know_count, c.valid_n),
    isZero: c.yes_count === 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 96, left: 0, bottom: 4 }} barCategoryGap="34%">
        <CartesianGrid horizontal={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={172}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={(props) => {
            const point = props.payload?.[0]?.payload as Row | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={props.active}
                title={point.label}
                rows={[
                  { label: "Yes", value: `${point.yes} (${point.percentYes}%)` },
                  { label: "No", value: point.no },
                  { label: "Don't know", value: point.dontKnow },
                  { label: "Valid N", value: point.validN },
                  { label: "Asked N", value: point.askedN },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="yesPct" stackId="response" fill="var(--series-1)" radius={[7, 0, 0, 7]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={`yes-${entry.label}`} fillOpacity={entry.isZero ? 0.3 : 1} />
          ))}
        </Bar>
        <Bar dataKey="noPct" stackId="response" fill="var(--baseline)" isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={`no-${entry.label}`} fillOpacity={entry.isZero ? 0.35 : 0.6} />
          ))}
        </Bar>
        <Bar dataKey="dkPct" stackId="response" fill="var(--series-4)" radius={[0, 7, 7, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={`dk-${entry.label}`} fillOpacity={entry.isZero ? 0.35 : 0.85} />
          ))}
          <LabelList
            content={(props: any) => {
              const idx = props.index as number;
              const entry = data[idx];
              if (!entry) return null;
              const x = (props.x as number) + (props.width as number) + 8;
              const y = (props.y as number) + (props.height as number) / 2;
              return (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  fontSize={12}
                  fontWeight={700}
                  fill={entry.isZero ? "var(--text-muted)" : "var(--text-primary)"}
                >
                  {entry.yes} ({entry.percentYes}%)
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
