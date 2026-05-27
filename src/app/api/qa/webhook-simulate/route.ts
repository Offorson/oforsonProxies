import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * QA harness: simulate a Stripe webhook event end-to-end.
 *
 * Mirrors what /api/billing/webhook will eventually do once Stripe
 * is wired up, but skips signature verification and lets you fire any
 * event from the sandbox UI. QA-gated; in QA mode any signed-in user
 * can call it.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  user_id: z.string().uuid(),
  event: z.enum([
    "checkout.session.completed",
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]),
  plan: z.enum(["starter", "pro", "business", "enterprise"]).default("pro"),
  proxy_type: z
    .enum(["static_residential", "rotating_residential", "datacenter"])
    .default("rotating_residential"),
  amount: z.number().nonnegative().default(99),
});

const PLAN_BANDWIDTH_GB: Record<string, number> = {
  starter: 100,
  pro: 750,
  business: 2000,
  enterprise: 10000,
};

function qaEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.QA_ROUTES_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  if (!qaEnabled()) {
    return NextResponse.json({ error: "QA routes disabled" }, { status: 404 });
  }

  try {
    await requireUser();
    const body = Body.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86_400_000);

    switch (body.event) {
      case "checkout.session.completed":
      case "customer.subscription.updated": {
        const { data: existing } = await admin
          .from("subscriptions")
          .select("id")
          .eq("user_id", body.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const subRow = {
          user_id: body.user_id,
          plan: body.plan,
          status: "active" as const,
          bandwidth_gb: PLAN_BANDWIDTH_GB[body.plan],
          bandwidth_used_gb: 0,
          proxy_type: body.proxy_type,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_subscription_id: `sub_qa_${body.user_id.slice(0, 8)}_${Date.now()}`,
        };

        if (existing) {
          await admin.from("subscriptions").update(subRow).eq("id", existing.id);
        } else {
          await admin.from("subscriptions").insert(subRow);
        }

        await admin.from("notifications").insert({
          user_id: body.user_id,
          title: "Subscription updated",
          body: `Your ${body.plan} plan is active until ${periodEnd.toDateString()}.`,
          type: "success",
        });
        break;
      }

      case "invoice.paid": {
        await admin.from("payment_history").insert({
          user_id: body.user_id,
          amount: body.amount,
          currency: "usd",
          status: "succeeded",
          invoice_url: `https://stripe.test/invoice/qa_${Date.now()}`,
          description: `${body.plan} plan manual simulate`,
          stripe_invoice_id: `in_qa_${Date.now()}`,
        });
        await admin.from("notifications").insert({
          user_id: body.user_id,
          title: "Payment received",
          body: `We charged $${body.amount.toFixed(2)} for your ${body.plan} plan. Thanks!`,
          type: "success",
        });
        break;
      }

      case "invoice.payment_failed": {
        await admin.from("payment_history").insert({
          user_id: body.user_id,
          amount: body.amount,
          currency: "usd",
          status: "failed",
          invoice_url: null,
          description: `${body.plan} plan payment failed`,
          stripe_invoice_id: `in_qa_fail_${Date.now()}`,
        });
        await admin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("user_id", body.user_id);
        await admin.from("notifications").insert({
          user_id: body.user_id,
          title: "Payment failed",
          body: `Your $${body.amount.toFixed(2)} charge for the ${body.plan} plan was declined. Update your card to avoid service interruption.`,
          type: "warning",
        });
        break;
      }

      case "customer.subscription.deleted": {
        await admin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", body.user_id);
        await admin.from("notifications").insert({
          user_id: body.user_id,
          title: "Subscription canceled",
          body: `Your ${body.plan} plan has been canceled. Active proxies will continue until the end of the billing period.`,
          type: "info",
        });
        break;
      }
    }

    return NextResponse.json({ ok: true, event: body.event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
