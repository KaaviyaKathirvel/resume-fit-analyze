import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FitResult } from "../types";
import { scoreColor } from "../lib/score";

interface FitScoreChartProps {
  results: FitResult[];
}

export function FitScoreChart({ results }: FitScoreChartProps) {
  const data = results
    .filter((r) => typeof r.fit_score === "number")
    .map((r) => ({
      name: r.job_title || "Untitled",
      score: r.fit_score as number,
    }));

  if (data.length === 0) return null;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 40, bottom: 8, left: 8 }}
          barCategoryGap={16}
        >
          <XAxis
            type="number"
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 8px 24px -12px rgb(16 24 40 / 0.2)",
              fontSize: 13,
            }}
            formatter={(value: number) => [`${value} / 10`, "Fit score"]}
          />
          <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={38}>
            {data.map((entry, i) => (
              <Cell key={i} fill={scoreColor(entry.score).hex} />
            ))}
            <LabelList
              dataKey="score"
              position="right"
              formatter={(v: number) => `${v}`}
              style={{ fontSize: 12, fontWeight: 700, fill: "#334155" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
