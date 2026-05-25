"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
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

export function BarChart({
  data,
  dataKey,
  xKey = "name",
  color = "#3b82f6",
  height = 240
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
        <XAxis dataKey={xKey} stroke="#9aa2b3" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
        <YAxis stroke="#9aa2b3" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 24px rgba(16,24,40,0.08)",
            fontSize: 12
          }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
