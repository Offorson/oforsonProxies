"use client";

import { useEffect, useState } from "react";
import {
  Globe2,
  Activity,
  Wifi,
  Zap,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Stat } from "@/components/ui/stat";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AreaChart } from "@/components/charts/area-chart";

interface DashboardData {
  // _auth is added by /api/dashboard so the client can prove which
  // user the server actually saw on this exact request.
  _auth?: { id: string; email: string | null } | null;
  subscription: {
    plan?: string | null;
    bandwidth_used_gb?: number | null;
    bandwidth_gb?: number | null;
    current_period_end?: string | null;
  } | null;
  activeProxyCount: number;
  bandwidthUsed7d: Array<{ name: string; gb: number }>;
  requestsToday: number;
}

const EMPTY: DashboardData = {
  subscription: null,
  activeProxyCount: 0,
  bandwidthUsed7d: [
    { name: "Mon", gb: 0 },
    { name: "Tue", gb: 0 },
    { name: "Wed", gb: 0 },
    { name: "Thu", gb: 0 },
    { name: "Fri", gb: 0 },
    { name: "Sat", gb: 0 },
    { name: "Sun", gb: 0 },
  ],
  requestsToday: 0,
};

export function DashboardLive() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = setTimeout(() => {
      if (!cancelled && !data) setData(EMPTY);
    }, 6000);

    (async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(EMPTY);
      } finally {
        clearTimeout(fallbackTimer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <DashboardSkeleton />;

  const sub = data.subscription;
  const hasPlan = !!sub;
  const planName = sub?.plan ?? null;
  const bwUsed = sub?.bandwidth_used_gb ?? 0;
  const bwTotal = sub?.bandwidth_gb ?? 0;
  const bwPct =
    bwTotal > 0 ? Math.min(100, Math.round((bwUsed / bwTotal) * 100)) : 0;
  const renewsAt = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <Stat
          label="Active proxies"
          value={data.activeProxyCount.toLocaleString()}
          icon={<Globe2 className="h-5 w-5" />}
        />
        <Stat
          label="Bandwidth used"
          value={`${bwUsed.toFixed(1)} GB`}
          hint={hasPlan ? `of ${bwTotal} GB` : "no active plan"}
          icon={<Zap className="h-5 w-5" />}
        />
        <Stat
          label="Active sessions"
          value={data.activeProxyCount.toLocaleString()}
          hint="right now"
          icon={<Wifi className="h-5 w-5" />}
        />
        <Stat
          label="Requests today"
          value={data.requestsToday.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bandwidth - last 7 days</CardTitle>
                <CardDescription>Across all proxy types</CardDescription>
              </div>
              <Badge variant="brand">{bwUsed.toFixed(1)} GB total</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AreaChart data={data.bandwidthUsed7d} dataKey="gb" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription className="capitalize">
              {hasPlan ? `${planName} - monthly` : "No active plan"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-ink-600">Bandwidth</p>
                <p className="text-sm font-medium text-ink-900">
                  {bwUsed.toFixed(1)} / {bwTotal} GB
                </p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blue-600 transition-all"
                  style={{ width: `${bwPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-400">{bwPct}% used</p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-600">Renews</span>
              <span className="font-medium text-ink-900">{renewsAt}</span>
            </div>

            {hasPlan ? (
              <Link
                href="/dashboard/billing"
                className="btn-outline w-full mt-2"
              >
                Manage subscription
              </Link>
            ) : (
              <Link
                href="/dashboard/billing"
                className="btn-primary w-full mt-2 justify-center"
              >
                Buy proxies
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasPlan && data.activeProxyCount === 0 ? (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-blue-50 mt-6">
          <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink-900">
                Generate your first proxy
              </h3>
              <p className="text-sm text-ink-600">
                Buy your first proxy package to get started datacenter, ISP,
                or rotating residential.
              </p>
            </div>
            <Link
              href="/dashboard/proxies"
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-ink-200 bg-white animate-pulse"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 h-72 rounded-2xl border border-ink-200 bg-white animate-pulse" />
        <div className="h-64 rounded-2xl border border-ink-200 bg-white animate-pulse" />
      </div>
    </div>
  );
}
