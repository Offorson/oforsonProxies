import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * QA harness: batch bandwidth usage report.
 *
 * Simulates what an edge function/cron would do when ingesting
 * a chunk of usage rows from Webshare, our upstream proxy provider.
 * For each user_id it:
 *   1. Inserts the raw bandwidth_usage rows
 *   2. Recomputes the user's subscription.bandwidth_used_gb
 *   3. Flags `over_cap: true` in the response for users now past their plan
 *   4. Writes a notification row when the user crosses 80% or hits the cap
 *
 * QA mode is the production gate. In QA mode any signed-in user can call
 * this — important because the harness routinely signs you in as a non-admin
 * test user mid-session.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  reports: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        bytes_used: z.number().int().nonnegative(),
        proxy_type: z.enum(["static_residential", "rotating_residential", "datacenter"]),
        recorded_at: z.string().datetime().optional(),
      })
    )
    .min(1)
    .max(500),
});

function qaEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.QA_ROUTES_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  if (!qaEnabled()) {
    return NextResponse.json({ error: "QA routes disabled" }, { status: 404 });
  }

  try {
    await requireUser();
    const { reports } = Body.parse(await request.json());
    const admin = createAdminClient();

    // 1. Insert raw usage rows
    const { error: insertErr } = await admin.from("bandwidth_usage").insert(
      reports.map((r) => ({
        user_id: r.user_id,
        bytes_used: r.bytes_used,
        proxy_type: r.proxy_type,
        recorded_at: r.recorded_at ?? new Date().toISOString(),
      }))
    );
    if (insertErr) throw insertErr;

    // 2. Recompute per-user totals for the current billing period
    const affectedUsers = Array.from(new Set(reports.map((r) => r.user_id)));
    const summary: Array<{
      user_id: string;
      bandwidth_gb: number;
      bandwidth_used_gb: number;
      over_cap: boolean;
    }> = [];

    for (const userId of affectedUsers) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, bandwidth_gb, current_period_start")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) continue;

      const { data: rows } = await admin
        .from("bandwidth_usage")
        .select("bytes_used")
        .eq("user_id", userId)
        .gte("recorded_at", sub.current_period_start);

      const totalBytes = (rows ?? []).reduce(
        (sum, r) => sum + Number(r.bytes_used ?? 0),
        0
      );
      const usedGb = Math.round((totalBytes / 1_073_741_824) * 100) / 100;

      await admin
        .from("subscriptions")
        .update({ bandwidth_used_gb: usedGb })
        .eq("id", sub.id);

      const cap = Number(sub.bandwidth_gb);
      const pct = cap > 0 ? (usedGb / cap) * 100 : 0;
      const overCap = usedGb > cap;

      // QA: fires duplicates if you hammer the button — fine. Real impl
      // should debounce via a last_threshold_notified column.
      if (overCap) {
        await admin.from("notifications").insert({
          user_id: userId,
          title: "Bandwidth limit reached",
          body: `You've used ${usedGb} GB of your ${cap} GB plan (${pct.toFixed(0)}%). Upgrade to keep your proxies active.`,
          type: "warning",
        });
      } else if (pct >= 80) {
        await admin.from("notifications").insert({
          user_id: userId,
          title: "Approaching bandwidth limit",
          body: `${pct.toFixed(0)}% of your monthly bandwidth used.`,
          type: "info",
        });
      }

      summary.push({
        user_id: userId,
        bandwidth_gb: cap,
        bandwidth_used_gb: usedGb,
        over_cap: overCap,
      });
    }

    return NextResponse.json({
      inserted: reports.length,
      affected_users: affectedUsers.length,
      summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
