"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Users, RotateCcw, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";

interface RevenueData {
  mrr: number;
  arr: number;
  paidUserCount: number;
  totalUserCount: number;
  planCounts: Record<string, number>;
  mrrByMonth: Array<{ name: string; usd: number }>;
  arpuByPlan: Array<{ name: string; usd: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as RevenueData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Revenue analytics" description="MRR, ARPU, churn and conversion in one place." />
        <div className="flex items-center justify-center py-20 text-ink-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading revenue data…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Revenue analytics" description="MRR, ARPU, churn and conversion in one place." />
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-700">
          {error ?? "No data available."}{" "}
          <button onClick={load} className="underline ml-2">Retry</button>
        </div>
      </>
    );
  }

  // Compute a rough "churn" proxy: fraction of total users with no active subscription
  const churnPct = data.totalUserCount > 0
    ? Math.max(0, ((data.totalUserCount - data.paidUserCount) / data.totalUserCount) * 100)
    : 0;

  // Conversion funnel
  const funnelPaid = data.paidUserCount;
  const funnelTotal = data.totalUserCount;
  const funnelFree = funnelTotal - funnelPaid;
  const maxFunnel = Math.max(funnelTotal, 1);

  return (
    <>
      <PageHeader
        title="Revenue analytics"
        description="MRR, ARPU, churn and conversion in one place."
        actions={
          <Button variant="outline" size="md" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="MRR" value={fmt(data.mrr)} icon={<DollarSign className="h-5 w-5" />} />
        <Stat label="ARR" value={fmt(data.arr)} icon={<TrendingUp className="h-5 w-5" />} />
        <Stat label="Paid users" value={data.paidUserCount.toLocaleString()} icon={<Users className="h-5 w-5" />} />
        <Stat label="Churn (est.)" value={`${churnPct.toFixed(1)}%`} hint="free vs paid ratio" icon={<RotateCcw className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>MRR — last 12 months</CardTitle>
            <CardDescription>Based on active subscription start dates</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChart data={data.mrrByMonth} dataKey="usd" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ARPU by plan</CardTitle>
            <CardDescription>Monthly price per plan</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={data.arpuByPlan} dataKey="usd" color="#3b82f6" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>User breakdown</CardTitle>
          <CardDescription>All registered users by subscription status</CardDescription>
        </CardHeader>
        <CardContent>
          {[
            { l: "Total users", v: funnelTotal, w: 100 },
            { l: "Paid subscribers", v: funnelPaid, w: Math.round((funnelPaid / maxFunnel) * 100) },
            { l: "Free / no plan", v: funnelFree, w: Math.round((funnelFree / maxFunnel) * 100) },
          ].map((r) => (
            <div key={r.l} className="mb-4 last:mb-0">
              <div className="flex justify-between text-sm">
                <span className="text-ink-700">{r.l}</span>
                <span className="font-medium text-ink-900">{r.v.toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blue-600"
                  style={{ width: `${r.w}%` }}
                />
              </div>
            </div>
          ))}

          {/* Plan distribution */}
          {Object.entries(data.planCounts).length > 0 && (
            <div className="mt-6 border-t border-ink-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">Active subscriptions by plan</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(data.planCounts).map(([plan, count]) => (
                  <div key={plan} className="rounded-xl border border-ink-100 p-3 text-center">
                    <p className="text-lg font-bold text-ink-900">{count}</p>
                    <p className="text-xs text-ink-500 capitalize">{plan}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
