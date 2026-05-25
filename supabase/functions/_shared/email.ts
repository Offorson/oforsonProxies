// =============================================================
// _shared/email.ts
// -------------------------------------------------------------
// Transactional email wrapper for the subscription lifecycle.
//
// Provider: Resend (https://resend.com). Sending is keyed off the
// RESEND_API_KEY function secret — if it is not configured, sendEmail
// becomes a safe no-op (logged + { skipped: true }) so the lifecycle
// still works end-to-end in environments without an email provider.
//
// Required / optional function secrets:
//   RESEND_API_KEY  — Resend API key (required to actually send)
//   EMAIL_FROM      — verified sender, e.g. "Oforson Proxies <billing@oforson.io>"
//   APP_URL         — public app origin, used to build the billing link
// =============================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ??
  "Oforson Proxies <billing@oforson.io>";
const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000")
  .replace(/\/+$/, "");

export interface SendResult {
  sent: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

/** POST a single email to the Resend API. No-ops cleanly without a key. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set — skipped: "${opts.subject}"`);
    return { sent: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Resend HTTP ${res.status}: ${body}` };
    }
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    return { sent: true, id: (data as { id?: string }).id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- Templates --------------------------------------------------------

const BRAND = "#2563eb";
const INK = "#0f172a";
const MUTED = "#475569";

/** Shared responsive shell so both emails look consistent. */
function layout(opts: {
  preheader: string;
  accent: string;
  heading: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">
        <tr><td style="height:5px;background:${opts.accent};"></td></tr>
        <tr><td style="padding:32px 36px 8px;">
          <div style="font-size:15px;font-weight:700;color:${BRAND};letter-spacing:.02em;">OFORSON PROXIES</div>
        </td></tr>
        <tr><td style="padding:8px 36px 0;">
          <h1 style="margin:0;font-size:21px;line-height:1.35;color:${INK};">${opts.heading}</h1>
        </td></tr>
        <tr><td style="padding:14px 36px 32px;font-size:15px;line-height:1.65;color:${MUTED};">
          ${opts.body}
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
          You are receiving this because you have an Oforson Proxies account.<br>
          Oforson Proxies · Premium residential &amp; datacenter proxies
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr><td style="border-radius:10px;background:${BRAND};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
    </td></tr>
  </table>`;
}

function fmtDeadline(graceEndsAt: string | null): string {
  if (!graceEndsAt) return "the end of the 48-hour grace period";
  const d = new Date(graceEndsAt);
  if (isNaN(d.getTime())) return "the end of the 48-hour grace period";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "UTC",
  });
}

/** Grace-period email — fired the moment a package enters past_due. */
export function pastDueEmail(params: {
  name: string;
  planLabel: string;
  graceEndsAt: string | null;
}): { subject: string; html: string } {
  const billingUrl = `${APP_URL}/dashboard/billing`;
  const deadline = fmtDeadline(params.graceEndsAt);
  const subject = "Action needed: your proxies are paused (48-hour hold)";

  const body = `
    <p style="margin:0 0 14px;">Hi ${params.name},</p>
    <p style="margin:0 0 14px;">
      We weren't able to process the renewal for your
      <strong style="color:${INK};">${params.planLabel}</strong> plan, so it has
      been moved to <strong style="color:${INK};">past due</strong> and your
      proxy traffic is <strong style="color:${INK};">temporarily paused</strong>.
    </p>
    <div style="margin:0 0 16px;padding:14px 16px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe;color:${INK};font-size:14px;line-height:1.6;">
      <strong>Your exact IP addresses are being held for you.</strong><br>
      We are reserving your full proxy allocation for a strict
      <strong>48-hour grace period</strong>, ending
      <strong>${deadline}</strong>. Settle your invoice within that window and
      the <strong>exact same proxies reactivate instantly</strong> — no
      reconfiguration, same IPs, same credentials.
    </div>
    <p style="margin:0 0 6px;">Pay your outstanding invoice here to restore service right away:</p>
    ${button("Settle invoice & reactivate", billingUrl)}
    <p style="margin:14px 0 0;font-size:13px;color:#94a3b8;">
      If the 48-hour window closes without payment, your reserved IPs are
      released back to the global pool and cannot be guaranteed afterwards.
    </p>`;

  return {
    subject,
    html: layout({
      preheader:
        `Your proxies are paused. We're holding your exact IPs until ${deadline}.`,
      accent: "#f59e0b",
      heading: "Your proxy plan is past due — IPs held for 48 hours",
      body,
    }),
  };
}

/** Final hard-drop email — fired when the 48-hour window closes. */
export function expiredEmail(params: {
  name: string;
  planLabel: string;
}): { subject: string; html: string } {
  const billingUrl = `${APP_URL}/dashboard/billing`;
  const subject = "Your proxy allocation has been released";

  const body = `
    <p style="margin:0 0 14px;">Hi ${params.name},</p>
    <p style="margin:0 0 14px;">
      The 48-hour grace period for your
      <strong style="color:${INK};">${params.planLabel}</strong> plan has ended
      without a successful payment. Your custom proxy allocation has now been
      <strong style="color:${INK};">released back into the global pool</strong>
      and access to those proxies is closed.
    </p>
    <p style="margin:0 0 14px;">
      You can start fresh any time — purchase a new plan and a new allocation
      will be provisioned to your account immediately.
    </p>
    ${button("Browse plans", billingUrl)}`;

  return {
    subject,
    html: layout({
      preheader: "Your grace period has ended and your proxies were released.",
      accent: "#ef4444",
      heading: "Your proxy allocation has been released",
      body,
    }),
  };
}

/**
 * Payment receipt email — sent by the payment webhooks on every confirmed
 * payment, for BOTH rails (Paystack card / bank transfer and NOWPayments
 * crypto). This is the app's own receipt, so a customer always gets a
 * branded confirmation regardless of what the payment gateway itself does.
 */
export function paymentReceiptEmail(params: {
  name: string;
  description: string;
  method: string;
  amountLabel: string;
  chargedLabel?: string | null;
  receiptRef: string;
  dateLabel: string;
  receiptUrl: string;
}): { subject: string; html: string } {
  const subject = `Your Oforson Proxies receipt — ${params.amountLabel}`;

  const row = (label: string, value: string, strong = false): string => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:${MUTED};border-top:1px solid #e2e8f0;">${label}</td>
      <td style="padding:8px 0;font-size:13px;text-align:right;color:${INK};border-top:1px solid #e2e8f0;font-weight:${
    strong ? "700" : "500"
  };">${value}</td>
    </tr>`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${params.name},</p>
    <p style="margin:0 0 16px;">
      Thank you for your purchase. This confirms that your payment to
      <strong style="color:${INK};">Oforson Proxies</strong> has been received.
      Your order is being provisioned and will appear on your account shortly.
    </p>
    <div style="margin:0 0 18px;padding:4px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:${MUTED};">Receipt number</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;color:${INK};font-weight:500;">${params.receiptRef}</td>
        </tr>
        ${row("Date", params.dateLabel)}
        ${row("Payment method", params.method)}
        ${row("Item", params.description)}
        ${row("Amount paid", params.amountLabel, true)}
        ${params.chargedLabel ? row("Settled as", params.chargedLabel) : ""}
      </table>
    </div>
    <p style="margin:0 0 6px;">Your full receipt is available on your dashboard:</p>
    ${button("View your receipt", params.receiptUrl)}
    <p style="margin:14px 0 0;font-size:13px;color:#94a3b8;">
      You can revisit this receipt any time from Billing &rarr; Invoice
      history in your dashboard.
    </p>`;

  return {
    subject,
    html: layout({
      preheader:
        `Payment received — ${params.amountLabel}. Your proxies are being provisioned.`,
      accent: "#10b981",
      heading: "Payment received — thank you",
      body,
    }),
  };
}
