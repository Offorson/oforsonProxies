import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET  /api/notifications        — list the most recent 20 notifications + unread count.
 * POST /api/notifications        — mark one or many as read (or all when { all: true }).
 */

export async function GET() {
  try {
    const { user } = await requireUser();
    const supabase = await createServerSupabase();

    const [listRes, countRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, read, type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);

    return NextResponse.json({
      notifications: listRes.data ?? [],
      unread: countRes.count ?? 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}

const PostBody = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const supabase = await createServerSupabase();
    const body = PostBody.parse(await request.json());

    let q = supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id);

    if ("ids" in body) q = q.in("id", body.ids);

    const { error } = await q;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
