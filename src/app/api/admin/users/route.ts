import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const PatchBody = z.object({
  userId: z.string().uuid(),
  account_status: z.enum(["active", "suspended", "pending_verification"]).optional(),
  bandwidth_gb: z.number().min(0).optional(),
  plan: z.string().optional(),
  description: z.string().optional()
});

export async function GET(request: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status");

  const supabase = createAdminClient();
  let query = supabase
    .from("profiles")
    .select(
      "id,email,username,account_status,is_admin,created_at,subscriptions(plan,bandwidth_used_gb,bandwidth_gb)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) query = query.ilike("email", `%${q}%`);
  if (status) query = query.eq("account_status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data, count });
}

export async function PATCH(request: NextRequest) {
  const { user } = await requireAdmin();
  const body = PatchBody.parse(await request.json());

  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (body.account_status) updates.account_status = body.account_status;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("profiles").update(updates).eq("id", body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.bandwidth_gb !== undefined) {
    await supabase.from("subscriptions").update({ bandwidth_gb: body.bandwidth_gb }).eq("user_id", body.userId);
  }

  // Tamper-evident audit log
  await supabase.from("admin_audit_logs").insert({
    admin_user_id: user.id,
    affected_user_id: body.userId,
    action_type: body.account_status ? "UPDATE_STATUS" : "UPDATE_USER",
    description: body.description ?? `Admin updated user ${body.userId}`,
    metadata: { ...body },
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] ?? null
  });

  return NextResponse.json({ ok: true });
}
