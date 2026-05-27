/**
 * Live analytics data for the dashboard Analytics tab.
 *
 * Everything here is derived from the signed-in user's real rows in
 * Supabase (bandwidth_usage + proxy_sessions). A brand-new account with no
 * usage correctly shows zeros there is no mock/placeholder data.
 *
 * Mirrors the resilient query pattern in src/lib/data/dashboard.ts: every
 * Supabase round-trip is wrapped in a timeout so a slow database can never
 * hang the page.
 */

import { createServerSupabase } from "@/lib/supabase/server";

export interface AnalyticsData {
  totalGb30d: number;
  gbToday: number;
  activeProxies: number;
  totalProxies: number;
  /** Daily GB transferred, oldest -> newest, last 30 days. */
  traffic30d: Array<{ name: string; gb: number }>;
  /** GB used per proxy type. */
  bandwidthByType: Array<{ name: string; gb: number }>;
}

const QUERY_TIMEOUT_MS = 4000;
const BYTES_PER_GB = 1_073_741_824;

const PROXY_TYPE_LABEL: Record<string, string> = {
  static_residential: "Static ISP",
  rotating_residential: "Rotating",
  datacenter: "Datacenter",
};

async function safe<T>(p: PromiseLike<T>, fallback: unknown, label: string): Promise<T> {
  try {
    return await Promise.race<T>([
      Promise.resolve(p),
      new Promise<T>((resolve) =>
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.warn(`[analytics] ${label} timed out after ${QUERY_TIMEOUT_MS}ms`);
          resolve(fallback as T);
        }, QUERY_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[analytics] ${label} threw:`, err);
    return fallback as T;
  }
}

/** Empty 30-day series, oldest -> newest, labelled M/D. */
function emptyMonth(): Array<{ name: string; gb: number }> {
  const out: Array<{ name: string; gb: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ name: `${d.getMonth() + 1}/${d.getDate()}`, gb: 0 });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function fetchUserAnalytics(): Promise<AnalyticsData> {
  const empty: AnalyticsData = {
    totalGb30d: 0,
    gbToday: 0,
    activeProxies: 0,
    totalProxies: 0,
    traffic30d: emptyMonth(),
    bandwidthByType: [
      { name: "Static ISP", gb: 0 },
      { name: "Rotating", gb: 0 },
      { name: "Datacenter", gb: 0 },
    ],
  };

  let supabase;
  try {
    supabase = await createServerSupabase();
  } catch {
    return empty;
  }

  const userRes = await safe(
    supabase.auth.getUser(),
    { data: { user: null } },
    "auth.getUser"
  );
  const user = (userRes as { data: { user: { id: string } | null } }).data.user;
  if (!user) return empty;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [bwRes, todayRes, activeRes, totalRes, sessionsRes] = await Promise.all([
    safe(
      supabase
        .from("bandwidth_usage")
        .select("bytes_used, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", thirtyDaysAgo.toISOString())
        .order("recorded_at", { ascending: true }),
      { data: [] },
      "bandwidth_usage 30d"
    ),
    safe(
      supabase
        .from("bandwidth_usage")
        .select("bytes_used")
        .eq("user_id", user.id)
        .gte("recorded_at", todayStart.toISOString()),
      { data: [] },
      "bandwidth_usage today"
    ),
    safe(
      supabase
        .from("proxy_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true),
      { count: 0 },
      "proxy_sessions active"
    ),
    safe(
      supabase
        .from("proxy_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      { count: 0 },
      "proxy_sessions total"
    ),
    safe(
      supabase
        .from("proxy_sessions")
        .select("proxy_type, bandwidth_used")
        .eq("user_id", user.id),
      { data: [] },
      "proxy_sessions by type"
    ),
  ]);

  const bwRows =
    (bwRes as { data: Array<{ bytes_used: number; recorded_at: string }> | null }).data ?? [];
  const todayRows = (todayRes as { data: Array<{ bytes_used: number }> | null }).data ?? [];
  const activeCount = (activeRes as { count: number | null }).count ?? 0;
  const totalCount = (totalRes as { count: number | null }).count ?? 0;
  const sessions =
    (sessionsRes as { data: Array<{ proxy_type: string; bandwidth_used: number }> | null }).data ?? [];

  // ---- 30-day daily traffic --------------------------------------------
  const byDay: Record<string, number> = {};
  const order: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    byDay[key] = 0;
    order.push(key);
  }
  let totalBytes30d = 0;
  for (const row of bwRows) {
    const bytes = Number(row.bytes_used) || 0;
    totalBytes30d += bytes;
    const key = new Date(row.recorded_at).toDateString();
    if (key in byDay) byDay[key] += bytes;
  }
  const traffic30d = order.map((key) => {
    const d = new Date(key);
    return {
      name: `${d.getMonth() + 1}/${d.getDate()}`,
      gb: round2(byDay[key] / BYTES_PER_GB),
    };
  });

  const todayBytes = todayRows.reduce((s, r) => s + (Number(r.bytes_used) || 0), 0);

  // ---- bandwidth by proxy type -----------------------------------------
  const typeTotals: Record<string, number> = {
    static_residential: 0,
    rotating_residential: 0,
    datacenter: 0,
  };
  for (const s of sessions) {
    if (s.proxy_type in typeTotals) {
      typeTotals[s.proxy_type] += Number(s.bandwidth_used) || 0;
    }
  }
  const bandwidthByType = Object.entries(typeTotals).map(([type, bytes]) => ({
    name: PROXY_TYPE_LABEL[type] ?? type,
    gb: round2(bytes / BYTES_PER_GB),
  }));

  return {
    totalGb30d: round2(totalBytes30d / BYTES_PER_GB),
    gbToday: round2(todayBytes / BYTES_PER_GB),
    activeProxies: activeCount,
    totalProxies: totalCount,
    traffic30d,
    bandwidthByType,
  };
}
