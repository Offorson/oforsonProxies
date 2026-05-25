import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * QA harness: deep diagnostic.
 *
 * Answers the question "why does signing in as a QA user show the same
 * dashboard as my own account?" by reporting, in one place:
 *
 *   - whether the server can see ANY signed-in user right now
 *   - whether the 6 expected seeded QA users actually exist in auth.users
 *   - whether each of those users has a subscription row in
 *     public.subscriptions, an active proxy_sessions row, and bandwidth
 *     usage in public.bandwidth_usage
 *   - the count of rows the *currently-signed-in user* owns in each of
 *     those tables (so you can compare to a QA user's counts)
 *
 * If the QA users exist in auth but have NO subscription / proxy /
 * bandwidth rows, that's why the dashboard renders identically no
 * matter who you sign in as — the seed data half of
 * 006_qa_seed.sql never landed in this project.
 *
 * QA-only.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function qaEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.QA_ROUTES_ENABLED === "true"
  );
}

const QA_EMAILS = [
  "admin@qa.oforson.test",
  "pro.res@qa.oforson.test",
  "biz.static@qa.oforson.test",
  "ent.dc@qa.oforson.test",
  "trial.dc@qa.oforson.test",
  "capped@qa.oforson.test",
];

export async function GET() {
  if (!qaEnabled()) {
    return NextResponse.json({ error: "QA routes disabled" }, { status: 404 });
  }

  // Always-on env-var sanity check.
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Who is the server actually authenticated as right now?
  let serverSession: {
    user_id: string | null;
    email: string | null;
    error?: string;
  } = { user_id: null, email: null };
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    serverSession = {
      user_id: data.user?.id ?? null,
      email: data.user?.email ?? null,
      error: error?.message,
    };
  } catch (err) {
    serverSession = {
      user_id: null,
      email: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({
      ok: false,
      env,
      serverSession,
      message:
        "SUPABASE_SERVICE_ROLE_KEY is not set, so I cannot inspect auth.users / subscriptions. Add it to .env.local to enable the deep diagnostic.",
    });
  }

  const admin = createAdminClient();

  // 1. Which QA users actually exist in auth.users?
  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id, email, is_admin, account_status")
    .in("email", QA_EMAILS);

  // 2. How many subscriptions / sessions / usage rows does each have?
  const detail: Array<{
    email: string;
    exists_in_profiles: boolean;
    profile_id: string | null;
    is_admin: boolean | null;
    account_status: string | null;
    subscriptions: number;
    proxy_sessions_active: number;
    bandwidth_usage_rows: number;
    notes: string[];
  }> = [];

  for (const email of QA_EMAILS) {
    const profile = profiles?.find((p) => p.email === email);
    const id = profile?.id ?? null;
    const notes: string[] = [];

    if (!profile) {
      detail.push({
        email,
        exists_in_profiles: false,
        profile_id: null,
        is_admin: null,
        account_status: null,
        subscriptions: 0,
        proxy_sessions_active: 0,
        bandwidth_usage_rows: 0,
        notes: ["Profile row missing — run 006_qa_seed.sql"],
      });
      continue;
    }

    const [{ count: subCount }, { count: psCount }, { count: bwCount }] =
      await Promise.all([
        admin
          .from("subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", id!),
        admin
          .from("proxy_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", id!)
          .eq("is_active", true),
        admin
          .from("bandwidth_usage")
          .select("*", { count: "exact", head: true })
          .eq("user_id", id!),
      ]);

    if ((subCount ?? 0) === 0 && !profile.is_admin) {
      notes.push("No subscription — dashboard will look empty for this user");
    }
    if ((psCount ?? 0) === 0 && !profile.is_admin) {
      notes.push("No active proxy_sessions");
    }
    if ((bwCount ?? 0) === 0 && !profile.is_admin) {
      notes.push("No bandwidth_usage history");
    }

    detail.push({
      email,
      exists_in_profiles: true,
      profile_id: id,
      is_admin: profile.is_admin ?? false,
      account_status: profile.account_status ?? null,
      subscriptions: subCount ?? 0,
      proxy_sessions_active: psCount ?? 0,
      bandwidth_usage_rows: bwCount ?? 0,
      notes,
    });
  }

  // 3. Same counts for whichever user the server currently sees.
  let currentUserCounts: {
    subscriptions: number;
    proxy_sessions_active: number;
    bandwidth_usage_rows: number;
  } | null = null;
  if (serverSession.user_id) {
    const [s, p, b] = await Promise.all([
      admin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", serverSession.user_id),
      admin
        .from("proxy_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", serverSession.user_id)
        .eq("is_active", true),
      admin
        .from("bandwidth_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", serverSession.user_id),
    ]);
    currentUserCounts = {
      subscriptions: s.count ?? 0,
      proxy_sessions_active: p.count ?? 0,
      bandwidth_usage_rows: b.count ?? 0,
    };
  }

  // Top-level verdict to make it easy to scan.
  const missingProfiles = detail.filter((d) => !d.exists_in_profiles);
  const profilesWithNoData = detail.filter(
    (d) => d.exists_in_profiles && !d.is_admin && d.subscriptions === 0
  );

  let verdict = "OK";
  const reasons: string[] = [];
  if (missingProfiles.length > 0) {
    verdict = "QA seed missing";
    reasons.push(
      `${missingProfiles.length} of ${QA_EMAILS.length} QA users have no profile row. Run database/migrations/006_qa_seed.sql.`
    );
  }
  if (profilesWithNoData.length > 0) {
    verdict = verdict === "OK" ? "QA seed partial" : verdict;
    reasons.push(
      `${profilesWithNoData.length} QA users exist but have NO subscription / sessions / bandwidth rows. The dashboard will look identical for them and for any other empty account. Re-run 006_qa_seed.sql.`
    );
  }
  if (profilesErr) {
    reasons.push("profiles query error: " + profilesErr.message);
  }

  return NextResponse.json({
    ok: verdict === "OK",
    verdict,
    reasons,
    env,
    serverSession,
    currentUserCounts,
    qaUsers: detail,
  });
}
