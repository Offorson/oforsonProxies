import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create a Stripe Checkout session. Plug in your own Stripe SDK call here.
 */
const Body = z.object({
  planId: z.string(),
  interval: z.enum(["monthly", "yearly"]).default("monthly")
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const { planId, interval } = Body.parse(await request.json());

    // TODO: integrate Stripe Checkout
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const session = await stripe.checkout.sessions.create({ ... });

    // Surface the action in the user's notification feed
    try {
      const admin = createAdminClient();
      await admin.from("notifications").insert({
        user_id: user.id,
        title: "Checkout started",
        body: `Redirected to Stripe for the ${planId} plan (${interval}).`,
        type: "info",
      });
    } catch {
      // service-role key missing in dev — non-fatal
    }

    return NextResponse.json({
      url: `https://checkout.stripe.com/c/example?plan=${planId}&interval=${interval}&uid=${user.id}`
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
