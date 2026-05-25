import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { proxyService } from "@/services/proxies";
import { createServerSupabase } from "@/lib/supabase/server";

const Body = z.object({
  type: z.enum(["static_residential", "rotating_residential", "datacenter"]),
  country: z.string().length(2).optional(),
  sessionId: z.string().optional(),
  quantity: z.number().int().min(1).max(500).optional()
});

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireUser();
    if (profile?.account_status !== "active") {
      return NextResponse.json({ error: "Account not active" }, { status: 403 });
    }

    const payload = Body.parse(await request.json());
    const proxies = await proxyService.generate(payload);

    // Record session(s) in the database so the user can see them in /dashboard/sessions.
    const supabase = await createServerSupabase();
    await supabase.from("proxy_sessions").insert(
      proxies.map((p) => ({
        user_id: user.id,
        proxy_type: p.type,
        country_code: p.country ?? "US",
        city: p.city ?? null,
        ip_address: p.host,
        port: p.port,
        username: p.username,
        password: p.password,
        last_checked_at: p.lastChecked ?? new Date().toISOString(),
        is_active: true
      }))
    );

    return NextResponse.json({ proxies });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: msg }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
