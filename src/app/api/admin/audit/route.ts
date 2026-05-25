import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  const supabase = createAdminClient();

  // Fetch logs and try to resolve admin/affected user emails from profiles
  const { data: logs, error } = await supabase
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!logs || logs.length === 0) {
    return NextResponse.json({ logs: [] });
  }

  // Collect unique user IDs to resolve emails in one query
  const userIds = [
    ...new Set([
      ...logs.map((l) => l.admin_user_id).filter(Boolean),
      ...logs.map((l) => l.affected_user_id).filter(Boolean),
    ]),
  ] as string[];

  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email")
      .in("id", userIds);
    if (profiles) {
      for (const p of profiles) {
        emailMap[p.id] = p.email;
      }
    }
  }

  const enriched = logs.map((l) => ({
    ...l,
    admin_email: emailMap[l.admin_user_id] ?? null,
    affected_email: l.affected_user_id ? (emailMap[l.affected_user_id] ?? null) : null,
  }));

  return NextResponse.json({ logs: enriched });
}
