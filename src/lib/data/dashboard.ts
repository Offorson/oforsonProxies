import { createServerSupabase } from "@/lib/supabase/server";
import type { Subscription } from "@/types";

export interface DashboardData {
  subscription: Subscription | null;
  activeProxyCount: number;
  bandwidthUsed7d: Array<{ name: string; gb: number }>;
  requestsToday: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Hard ceiling on every Supabase round-trip. Without this, a stuck
// network / RLS recursion / DNS hiccup would leave the dashboard
// server-rendering forever and the user would just see app/loading.tsx.
const QUERY_TIMEOUT_MS = 4000;

async function safe<T>(p: PromiseLike<T>, fallback: unknown, label: string): Promise<T> {
  try {
    return await Promise.race<T>([
      Promise.resolve(p),
      new Promise<T>((resolve) =>
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.warn(`[dashboard] ${label} timed out after ${QUERY_TIMEOUT_MS}ms`);
          resolve(fallback as T);
        }, QUERY_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[dashboard] ${label} threw:`, err);
    return fallback as T;
  }
}

const EMPTY_WEEK: DashboardData["bandwidthUsed7d"] = [
  { name: "Mon", gb: 0 },
  { name: "Tue", gb: 0 },
  { name: "Wed", gb: 0 },
  { name: "Thu", gb: 0 },
  { name: "Fri", gb: 0 },
  { name: "Sat", gb: 0 },
  { name: "Sun", gb: 0 },
];

export async function fetchUserDashboardData(): Promise<DashboardData> {
  const empty: DashboardData = {
    subscription: null,
    activeProxyCount: 0,
    bandwidthUsed7d: EMPTY_WEEK,
    requestsToday: 0,
  };

  let supabase;
  try {
    supabase = await createServerSupabase();
  } catch {
    return empty;
  }

  const userRes = await safe(
    supabase.auth.getUser(),
    { data: { user: null }, error: null },
    "auth.getUser"
  );
  const user = (userRes as { data: { user: { id: string } | null } }).data.user;
  if (!user) return empty;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [subRes, activeRes, bwRes, todayCountRes] = await Promise.all([
    safe(
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<Subscription>(),
      { data: null },
      "subscriptions"
    ),
    safe(
      supabase
        .from("proxy_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true),
      { count: 0 },
      "proxy_sessions count"
    ),
    safe(
      supabase
        .from("bandwidth_usage")
        .select("bytes_used, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", sevenDaysAgo.toISOString())
        .order("recorded_at", { ascending: true }),
      { data: [] },
      "bandwidth_usage rows"
    ),
    safe(
      supabase
        .from("bandwidth_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("recorded_at", todayStart.toISOString()),
      { count: 0 },
      "bandwidth_usage count"
    ),
  ]);

  const sub = (subRes as { data: Subscription | null }).data;
  const activeCount = (activeRes as { count: number | null }).count;
  const bwRows = (bwRes as { data: Array<{ bytes_used: number; recorded_at: string }> | null }).data ?? [];
  const todayCount = (todayCountRes as { count: number | null }).count;

  const byDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay[d.toDateString()] = 0;
  }
  for (const row of bwRows) {
    const key = new Date(row.recorded_at).toDateString();
    if (key in byDay) byDay[key] += row.bytes_used;
  }
  const bandwidthUsed7d = Object.entries(byDay).map(([dateStr, bytes]) => ({
    name: DAY_LABELS[new Date(dateStr).getDay()],
    gb: Math.round((bytes / 1_073_741_824) * 100) / 100,
  }));

  return {
    subscription: sub ?? null,
    activeProxyCount: activeCount ?? 0,
    bandwidthUsed7d: bandwidthUsed7d.length > 0 ? bandwidthUsed7d : EMPTY_WEEK,
    requestsToday: todayCount ?? 0,
  };
}
