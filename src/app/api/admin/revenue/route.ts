import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Monthly price per plan in USD
const PLAN_PRICE: Record<string, number> = {
  free: 0,
  starter: 29,
  pro: 99,
  business: 299,
  enterprise: 1200,
};

export async function GET() {
  await requireAdmin();
  const supabase = createAdminClient();

  // Pull all active/trialing subscriptions
  const { data: subs, error: subErr } = await supabase
    .from("subscriptions")
    .select("plan,status,user_id,created_at")
    .in("status", ["active", "trialing"]);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 400 });

  // Total users in profiles (all statuses)
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // Count paid subs per plan
  const planCounts: Record<string, number> = {};
  let mrr = 0;
  for (const s of subs ?? []) {
    const plan = (s.plan ?? "free") as string;
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
    mrr += PLAN_PRICE[plan] ?? 0;
  }

  const paidUserCount = Object.entries(planCounts)
    .filter(([p]) => p !== "free")
    .reduce((acc, [, n]) => acc + n, 0);

  // MRR by month — last 12 months based on subscription created_at
  // We approximate: count subs created on or before each month-end still active today
  const now = new Date();
  const mrrByMonth: Array<{ name: string; usd: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const label = d.toLocaleString("en-US", { month: "short" });
    // Subscriptions created on or before this month-end
    const active = (subs ?? []).filter(
      (s) => new Date(s.created_at) <= monthEnd
    );
    const monthMrr = active.reduce(
      (acc, s) => acc + (PLAN_PRICE[(s.plan ?? "free") as string] ?? 0),
      0
    );
    mrrByMonth.push({ name: label, usd: monthMrr });
  }

  // ARPU by plan (average revenue per user = plan price, since all paying the same rate)
  const arpuByPlan = Object.entries(PLAN_PRICE)
    .filter(([p]) => p !== "free" && p !== "enterprise")
    .map(([name, usd]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      usd,
    }));
  // Add enterprise
  arpuByPlan.push({ name: "Enterprise", usd: PLAN_PRICE.enterprise });

  return NextResponse.json({
    mrr,
    arr: mrr * 12,
    paidUserCount,
    totalUserCount: totalUsers ?? 0,
    planCounts,
    mrrByMonth,
    arpuByPlan,
  });
}
