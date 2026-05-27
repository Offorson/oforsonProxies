import { NextResponse } from "next/server";
import { fetchUserDashboardData } from "@/lib/data/dashboard";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Returns who the server *currently* sees as the signed-in user
// (read fresh from cookies on every request), plus the dashboard data
// for that user. The _auth block is what the harness uses to prove
// the auth swap actually flowed through to the server.
export async function GET() {
  let authedUser: { id: string; email: string | null } | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      authedUser = { id: data.user.id, email: data.user.email ?? null };
    }
  } catch {
    /* ignore fetchUserDashboardData handles its own fallbacks */
  }

  try {
    const data = await fetchUserDashboardData();
    return NextResponse.json(
      { _auth: authedUser, ...data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        _auth: authedUser,
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
        _error: err instanceof Error ? err.message : String(err),
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
