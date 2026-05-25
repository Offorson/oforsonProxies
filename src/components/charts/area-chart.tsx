"use client";

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

interface Props {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  xKey?: string;
  color?: string;
  height?: number;
}

export function AreaChart({
  data,
  dataKey,
  xKey = "name",
  color = "#06b6d4",
  height = 240
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke="#9aa2b3"
          tickLine={false}
          axisLine={false}
          style={{ fontSize: 12 }}
        />
        <YAxis
          stroke="#9aa2b3"
          tickLine={false}
          axisLine={false}
          style={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 24px rgba(16,24,40,0.08)",
            fontSize: 12
          }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#g-${dataKey})`}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
