// =============================================================
// Supabase Edge Function: subscription-lifecycle
// -------------------------------------------------------------
// The transactional-email arm of the subscription expiration +
// 48-hour grace period lifecycle (migration 014).
//
// The status changes, proxy suspension/release and in-app
// notifications are all handled inside Postgres by triggers. This
// function exists purely to send the two customer emails and to
// offer a manual handle on the background worker.
//
// Invocations:
//   { "event": "past_due", "subscription_id": "<uuid>" }
//       -> sent by a DB trigger (pg_net) the moment a package goes
//          past_due. Emails the 48-hour grace-period notice.
//   { "event": "expired", "subscription_id": "<uuid>" }
//       -> sent by a DB trigger when the 48h window closes.
//          Emails the final hard-drop notice.
//   { "event": "sweep" }
//       -> runs run_subscription_lifecycle_sweep() on demand (the
//          same body pg_cron runs hourly). Handy for testing or for
//          driving the worker from an external scheduler.
//
// Authentication (this function is NOT behind Supabase JWT — deploy
// with verify_jwt = false):
//   * header  x-lifecycle-secret: <LIFECYCLE_SHARED_SECRET>   (used
//     by the DB trigger), OR
//   * header  Authorization: Bearer <SERVICE_ROLE_KEY>        (used
//     by server-side callers / manual runs).
//
// Required function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   LIFECYCLE_SHARED_SECRET   — shared secret, also stored in
//                               private.app_config.lifecycle_shared_secret
//   RESEND_API_KEY            — Resend key (see _shared/email.ts)
// Optional:
//   EMAIL_FROM, APP_URL
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { expiredEmail, pastDueEmail, sendEmail } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHARED_SECRET = Deno.env.get("LIFECYCLE_SHARED_SECRET") ?? "";

const jsonHeaders = { "Content-Type": "application/json" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

interface ProfileRow {
  email: string;
  username: string | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  grace_period_ends_at: string | null;
  past_due_email_sent_at: string | null;
  expired_email_sent_at: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
}

/** Turn a stored plan slug ("rotating_residential", "pro") into a label. */
function planLabel(plan: string): string {
  const map: Record<string, string> = {
    static_residential: "Static Residential",
    rotating_residential: "Rotating Residential",
    datacenter: "Datacenter",
  };
  if (map[plan]) return map[plan];
  return plan
    .split(/[_\s-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Authorise the caller via the shared secret or the service-role key. */
function isAuthorised(req: Request): boolean {
  const secret = req.headers.get("x-lifecycle-secret") ?? "";
  if (SHARED_SECRET && secret === SHARED_SECRET) return true;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (SERVICE_ROLE_KEY && bearer === SERVICE_ROLE_KEY) return true;

  return false;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[lifecycle] Supabase service credentials are not configured");
    return json({ error: "server misconfigured" }, 500);
  }
  if (!isAuthorised(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { event?: string; subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  const event = String(body.event ?? "").toLowerCase();
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Manual / external worker run -----------------------------------
  if (event === "sweep") {
    const { data, error } = await supabase.rpc("run_subscription_lifecycle_sweep");
    if (error) {
      console.error("[lifecycle] sweep failed:", error.message);
      return json({ ok: false, error: error.message }, 500);
    }
    console.log("[lifecycle] sweep:", JSON.stringify(data));
    return json({ ok: true, event: "sweep", result: data });
  }

  // ---- Email events ---------------------------------------------------
  if (event !== "past_due" && event !== "expired") {
    return json({ error: `unsupported event: ${event || "(none)"}` }, 400);
  }

  const subscriptionId = String(body.subscription_id ?? "");
  if (!subscriptionId) {
    return json({ error: "subscription_id is required" }, 400);
  }

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select(
      "id, user_id, plan, status, grace_period_ends_at, " +
        "past_due_email_sent_at, expired_email_sent_at, profiles(email, username)",
    )
    .eq("id", subscriptionId)
    .maybeSingle<SubscriptionRow>();

  if (subErr) {
    console.error("[lifecycle] subscription lookup failed:", subErr.message);
    return json({ ok: false, error: subErr.message }, 500);
  }
  if (!sub) {
    return json({ ok: false, error: "subscription not found" }, 404);
  }

  const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
  if (!profile?.email) {
    return json({ ok: false, error: "no email on file for this customer" }, 422);
  }

  // Idempotency — the trigger nulls the *_email_sent_at column on each
  // status transition, so a stamped value means this email already went.
  const alreadySent = event === "past_due"
    ? sub.past_due_email_sent_at
    : sub.expired_email_sent_at;
  if (alreadySent) {
    return json({ ok: true, event, note: "email already sent", skipped: true });
  }

  const name = profile.username || profile.email.split("@")[0];
  const label = planLabel(sub.plan);

  const mail = event === "past_due"
    ? pastDueEmail({ name, planLabel: label, graceEndsAt: sub.grace_period_ends_at })
    : expiredEmail({ name, planLabel: label });

  const result = await sendEmail({
    to: profile.email,
    subject: mail.subject,
    html: mail.html,
  });

  if (!result.sent && !result.skipped) {
    console.error(`[lifecycle] ${event} email failed:`, result.error);
    // Leave *_email_sent_at null so the next sweep / retry can resend.
    return json({ ok: false, event, error: result.error }, 502);
  }

  // Stamp the idempotency column (also when skipped, so a provider-less
  // environment does not retry forever).
  const stampColumn = event === "past_due"
    ? "past_due_email_sent_at"
    : "expired_email_sent_at";
  const { error: stampErr } = await supabase
    .from("subscriptions")
    .update({ [stampColumn]: new Date().toISOString() })
    .eq("id", subscriptionId);
  if (stampErr) {
    console.error("[lifecycle] stamp failed:", stampErr.message);
  }

  console.log(
    `[lifecycle] ${event} email for ${subscriptionId} -> ${profile.email} ` +
      `(${result.sent ? "sent" : "skipped — no RESEND_API_KEY"})`,
  );
  return json({
    ok: true,
    event,
    subscription_id: subscriptionId,
    emailed: profile.email,
    delivered: result.sent === true,
    skipped: result.skipped === true,
  });
});
