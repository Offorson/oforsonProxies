import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook — recurring-billing lifecycle hook.
 *
 * This is the entry point for Stripe's recurring-billing events. The
 * heavy lifting (suspending proxy credentials, holding the IPs for the
 * 48-hour grace window, sending the grace-period email, and the final
 * hard-drop) is all done by database triggers in migration 014. This
 * route only has to move public.subscriptions.status — everything
 * downstream is automatic:
 *
 *   invoice.payment_failed          -> status = 'past_due'
 *   customer.subscription.deleted   -> status = 'past_due'  (enters the
 *                                      48h grace window before expiry)
 *   customer.subscription.updated   -> mirror Stripe's status when it
 *                                      reports past_due / unpaid / active
 *   invoice.paid / payment_succeeded -> status = 'active' (settling the
 *                                      invoice inside the window snaps
 *                                      the original proxies back online)
 *
 * PRODUCTION HARDENING (do before going live):
 *   Verify the payload with stripe.webhooks.constructEvent() against
 *   STRIPE_WEBHOOK_SECRET and the `stripe-signature` header. The handler
 *   below is signature-tolerant so the lifecycle can be exercised in
 *   dev / QA; an unverified event must never be trusted in production.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAST_DUE_EVENTS = new Set([
  "invoice.payment_failed",
  "customer.subscription.deleted",
]);
const RECOVERY_EVENTS = new Set([
  "invoice.paid",
  "invoice.payment_succeeded",
]);

type StripeObject = Record<string, unknown>;

/** Pull the Stripe subscription id out of whatever object the event carries. */
function stripeSubscriptionId(obj: StripeObject): string | null {
  if (typeof obj.subscription === "string") return obj.subscription;
  if (obj.object === "subscription" && typeof obj.id === "string") return obj.id;
  return null;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  let event: { type?: string; data?: { object?: StripeObject } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = String(event.type ?? "");
  const obj = (event.data?.object ?? {}) as StripeObject;
  console.log(`[stripe webhook] event=${type}`);

  const admin = createAdminClient();

  // Resolve the local package this event belongs to.
  const subId = stripeSubscriptionId(obj);
  const base = admin.from("subscriptions").select("id, status, current_period_end");

  let filtered;
  if (subId) {
    filtered = base.eq("stripe_subscription_id", subId);
  } else if (typeof obj.customer_email === "string") {
    // Fallback: map via the customer's email -> profile.
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", obj.customer_email)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ received: true, handled: false, note: "no matching customer" });
    }
    filtered = base.eq("user_id", profile.id as string);
  } else {
    return NextResponse.json({ received: true, handled: false, note: "no subscription reference" });
  }

  const { data: sub } = await filtered
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) {
    return NextResponse.json({ received: true, handled: false, note: "subscription not found" });
  }

  // ---- Recurring billing failed / subscription ended -> past_due ------
  if (PAST_DUE_EVENTS.has(type)) {
    if (sub.status === "past_due" || sub.status === "expired") {
      return NextResponse.json({ received: true, handled: true, note: "already past due" });
    }
    // Flipping status fires the DB trigger: proxies suspended, IPs held
    // for 48h, grace-period email dispatched, customer notified.
    await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
    return NextResponse.json({ received: true, handled: true, status: "past_due" });
  }

  // ---- customer.subscription.updated -> mirror Stripe's status --------
  if (type === "customer.subscription.updated") {
    const stripeStatus = String(obj.status ?? "");
    if ((stripeStatus === "past_due" || stripeStatus === "unpaid") && sub.status === "active") {
      await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
      return NextResponse.json({ received: true, handled: true, status: "past_due" });
    }
    if (stripeStatus === "active" && sub.status === "past_due") {
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .eq("id", sub.id);
      return NextResponse.json({ received: true, handled: true, status: "active" });
    }
    return NextResponse.json({ received: true, handled: false, note: "no status change" });
  }

  // ---- Invoice settled -> recover the package out of past_due ---------
  if (RECOVERY_EVENTS.has(type)) {
    if (sub.status === "past_due") {
      // Recovering inside the 48h window reactivates the SAME proxies
      // (handled by the DB trigger).
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .eq("id", sub.id);
      return NextResponse.json({ received: true, handled: true, status: "active" });
    }
    return NextResponse.json({ received: true, handled: false, note: "package not past due" });
  }

  return NextResponse.json({ received: true, handled: false });
}
