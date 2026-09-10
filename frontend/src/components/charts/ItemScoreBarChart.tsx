import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox } from "./ChartTooltip";
import { wrapLabel } from "./chartHelpers";

const ROW_HEIGHT = 40;
const LINE_HEIGHT = 15;
const FONT_SIZE = 12;
// Conservative average glyph width (px) at FONT_SIZE - same convention as
// HorizontalBarChart's AVG_CHAR_PX, deliberately an underestimate so
// wrapping triggers a little early rather than letting a long label
// overflow into the bars.
const AVG_CHAR_PX = 6;

export interface ItemScoreDatum {
  label: string;
  mean: number | null;
  validN: number;
  total: number;
}

interface ItemScoreBarChartProps {
  data: ItemScoreDatum[];
  labelWidth?: number;
  color?: string;
  domainMax?: number;
}

function maxWrappedLines(data: ItemScoreDatum[], labelWidth: number): number {
  const maxChars = Math.max(6, Math.floor((labelWidth - 10) / AVG_CHAR_PX));
  return Math.max(1, ...data.map((d) => wrapLabel(d.label, maxChars).length));
}

function makeCategoryTick(width: number) {
  const maxChars = Math.max(6, Math.floor((width - 10) / AVG_CHAR_PX));
  return function CategoryTick({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) {
    const lines = wrapLabel(payload.value, maxChars);
    const startDy = -((lines.length - 1) / 2) * LINE_HEIGHT;
    return (
      <text x={x} y={y} dominantBaseline="central" textAnchor="end" fontSize={FONT_SIZE} fontWeight={600} fill="var(--text-secondary)">
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
}

/** A horizontal bar chart for a fixed-scale (1-5) mean-score item set -
 * Items 1-8 and the Monday-Sunday day breakdown on the Physical Activity
 * (PAQ-C) page. Deliberately separate from `HorizontalBarChart` (which is
 * built around category-count distributions and labels every bar
 * "n (%)") since a mean-score bar's label/tooltip semantics are different
 * (mean + valid N, not a share of a total) - reuses the same visual
 * language (wrapped category ticks, thin rounded bars, dashed gridlines)
 * so it still reads as one family of charts with Dietary Intake's. */
export default function ItemScoreBarChart({ data, labelWidth = 176, color = "var(--series-1)", domainMax = 5 }: ItemScoreBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const rowHeight = ROW_HEIGHT + (maxWrappedLines(data, labelWidth) - 1) * LINE_HEIGHT;
  const height = Math.max(150, data.length * rowHeight);
  // Stable across hover-only re-renders (activeIndex changing) - without
  // this, `tick` receives a new component identity on every hover, so
  // Recharts remounts the Y-axis tick nodes on every mouse move.
  const categoryTick = useMemo(() => makeCategoryTick(labelWidth), [labelWidth]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 74, left: 0, bottom: 4 }} barCategoryGap="26%">
        <CartesianGrid horizontal={false} stroke="var(--gridline)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          domain={[0, domainMax]}
          ticks={[1, 2, 3, 4, 5]}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={categoryTick}
          axisLine={false}
          tickLine={false}
          width={labelWidth}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={(props) => {
            const point = props.payload?.[0]?.payload as ItemScoreDatum | undefined;
            if (!point) return null;
            return (
              <ChartTooltipBox
                active={props.active}
                title={point.label}
                rows={
                  point.mean !== null
                    ? [
                        { label: "Mean score", value: point.mean.toFixed(2) },
                        { label: "Valid N", value: `${point.validN}/${point.total}` },
                      ]
                    : [{ label: "Mean score", value: "No data acquired" }]
                }
              />
            );
          }}
        />
        <Bar
          dataKey="mean"
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
          isAnimationActive={false}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(undefined)}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={color}
              fillOpacity={activeIndex === undefined || activeIndex === index ? 1 : 0.55}
            />
          ))}
          <LabelList
            content={(props: any) => {
              const idx = props.index as number;
              const entry = data[idx];
              if (!entry || entry.mean === null) return null;
              const x = (props.x as number) + (props.width as number) + 8;
              const y = (props.y as number) + (props.height as number) / 2;
              return (
                <text x={x} y={y} dy={4} fontSize={12} fontWeight={700} fill="var(--text-primary)">
                  {`${entry.mean.toFixed(2)} · n=${entry.validN}`}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
