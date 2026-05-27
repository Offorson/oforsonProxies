import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Returns the proxies the signed-in user owns - the data behind the
 * Proxies dashboard tab.
 *
 * Webshare-style list semantics:
 *  - Every proxy the customer has ever been allocated lives in
 *    proxy_sessions. Buying more proxies simply appends new rows, so an
 *    existing active (or past_due / suspended) allocation is never
 *    replaced - newly purchased proxies are added alongside it.
 *  - 'released' proxies (credentials wiped after a package expired) are
 *    excluded: their IPs have gone back to the global pool.
 *  - 'suspended' proxies (package in its 48h grace window) ARE returned
 *    so the customer still sees the IPs we are holding for them.
 *  - Rows with no ip_address (provisioning placeholders) are skipped.
 *
 * Each row is enriched with `bandwidth_exceeded`: a proxy whose
 * bandwidth_used has crossed its per-proxy bandwidth_limit_gb cap is, like
 * on Webshare, treated as stopped it has run out of bandwidth.
 */
const BYTES_PER_GB = 1_073_741_824;

export async function GET() {
  try {
    const { user } = await requireUser();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("proxy_sessions")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "released")
      .not("ip_address", "is", null)
      .order("started_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const proxies = (data ?? []).map((p) => {
      const limitGb = Number(p.bandwidth_limit_gb ?? 0);
      const usedBytes = Number(p.bandwidth_used ?? 0);
      const bandwidth_exceeded =
        limitGb > 0 && usedBytes >= limitGb * BYTES_PER_GB;
      return { ...p, bandwidth_exceeded };
    });

    return NextResponse.json({ proxies, sessions: proxies });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
