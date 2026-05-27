import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, RotateCcw, ExternalLink } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { COUNTRIES } from "@/constants/plans";
import { ReceiptActions } from "./receipt-actions";

export const metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_url: string | null;
  invoice_id: string | null;
  description: string | null;
  payment_method: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  proxy_type: string;
  quantity: number;
  total_amount: number;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Oforson Proxies";

// ---- formatting helpers ----------------------------------------------

function money(amount: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return amount.toLocaleString("en-US", { style: "currency", currency: code });
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A short, human-friendly reference for a payment row. */
function receiptRef(p: PaymentRow): string {
  if (p.invoice_id) return p.invoice_id;
  return p.id.slice(0, 8).toUpperCase();
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function productLabel(t?: string): string {
  switch (t) {
    case "datacenter":
      return "Datacenter proxies";
    case "static_residential":
      return "Static residential proxies";
    case "rotating_residential":
      return "Rotating residential proxies";
    default:
      return "Proxy plan";
  }
}

function methodLabel(payment: PaymentRow, meta: Record<string, unknown>): string {
  const paystack = asObj(meta.paystack);
  if (paystack.payment_channel === "bank_transfer") return "Bank transfer";
  const m = (payment.payment_method || "").toLowerCase();
  if (m === "crypto") return "Cryptocurrency";
  if (m === "card") return "Card";
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "-";
}

function countryName(code: string): string {
  if (!code || code === "WW" || code === "ZZ") return "Worldwide mix";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** Humanise an auto-refresh frequency given in seconds. */
function describeFrequency(seconds: number): string {
  if (seconds <= 0) return "No auto-refresh";
  if (seconds % 86400 === 0) return `Every ${seconds / 86400} day(s)`;
  if (seconds % 3600 === 0) return `Every ${seconds / 3600} hour(s)`;
  if (seconds % 60 === 0) return `Every ${seconds / 60} minute(s)`;
  return `Every ${seconds}s`;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user.id) notFound();

  const supabase = await createServerSupabase();

  // ---- 1. Load the payment, scoped to the signed-in user --------------
  const { data: payment } = await supabase
    .from("payment_history")
    .select(
      "id, user_id, amount, currency, status, invoice_url, invoice_id, description, payment_method, created_at"
    )
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle<PaymentRow>();

  if (!payment) notFound();

  // ---- 2. Best-effort enrich with the originating order ---------------
  // Both rails set proxy_orders.invoice_id to the same value stored on the
  // payment_history row, so the order (with its full config + pricing
  // breakdown) can be matched back without a dedicated foreign key.
  let order: OrderRow | null = null;
  if (payment.invoice_id) {
    const { data } = await supabase
      .from("proxy_orders")
      .select("id, proxy_type, quantity, total_amount, status, metadata, created_at")
      .eq("invoice_id", payment.invoice_id)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<OrderRow>();
    order = data ?? null;
  }

  const meta = asObj(order?.metadata);
  const config = asObj(meta.config);
  const pricing = asObj(meta.pricing);
  const paystack = asObj(meta.paystack);
  const addons = asObj(config.addons);

  const ok = payment.status === "succeeded";
  const refunded = payment.status === "refunded";
  const statusLabel = ok ? "Paid" : refunded ? "Refunded" : "Failed";

  const amount = num(payment.amount);
  const usdCurrency = (payment.currency || "usd").toUpperCase();

  // Settlement currency (Paystack charges in the customer's local currency).
  const chargeCurrency = str(paystack.charge_currency).toUpperCase();
  const chargeAmount = num(paystack.charge_amount);
  const fxRate = num(paystack.fx_rate);
  const showCharge =
    !!chargeCurrency && chargeCurrency !== usdCurrency && chargeAmount > 0;

  // Crypto: the coin the customer actually paid with, when known.
  const payCurrency = str(meta.pay_currency).toUpperCase();

  const proxyType = str(config.type) || str(order?.proxy_type);
  const billingUnit = str(config.billing_unit);
  const isBandwidth = billingUnit === "bandwidth_gb";
  const qty = num(config.qty) || num(order?.quantity);
  const gb = num(config.gb);

  const detailRows: Array<[string, string]> = [];
  if (order) {
    detailRows.push(["Product", productLabel(proxyType)]);
    if (isBandwidth) {
      detailRows.push(["Bandwidth", `${gb} GB`]);
    } else {
      detailRows.push(["Quantity", `${qty.toLocaleString()} ${qty === 1 ? "proxy" : "proxies"}`]);
    }
    if (config.exclusivity) {
      const ex = str(config.exclusivity);
      detailRows.push(["Network", ex.charAt(0).toUpperCase() + ex.slice(1)]);
    }
    if (config.country) detailRows.push(["Location", countryName(str(config.country))]);
    if (!isBandwidth) {
      detailRows.push([
        "Bandwidth tier",
        config.unlimited === true ? "Unlimited" : `${num(config.standard_gb)} GB`,
      ]);
    }
    const addonBits: string[] = [];
    if (num(addons.automaticRefreshFrequency) > 0)
      addonBits.push(describeFrequency(num(addons.automaticRefreshFrequency)));
    if (num(addons.proxyReplacements) > 0)
      addonBits.push(`${num(addons.proxyReplacements).toLocaleString()} manual replacements`);
    if (addons.highPriorityNetwork === true) addonBits.push("High-priority network");
    if (addonBits.length) detailRows.push(["Add-ons", addonBits.join(" · ")]);
    const term = str(pricing.term);
    if (term) detailRows.push(["Billing term", term.charAt(0).toUpperCase() + term.slice(1)]);
  }

  const lineItem =
    payment.description ||
    (order ? `${productLabel(proxyType)} ${APP_NAME}` : "Proxy purchase");

  return (
    <>
      <ReceiptActions />

      <div className="print-area mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
          {/* Accent bar */}
          <div
            className={
              "h-1.5 " +
              (ok
                ? "bg-gradient-to-r from-brand-500 to-blue-600"
                : refunded
                  ? "bg-amber-500"
                  : "bg-rose-500")
            }
          />

          <div className="p-8 sm:p-10">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-brand-600">
                  {APP_NAME}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Premium residential &amp; datacenter proxies
                </p>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold tracking-tight text-ink-900">
                  Receipt
                </h1>
                <span
                  className={
                    "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " +
                    (ok
                      ? "bg-emerald-50 text-emerald-700"
                      : refunded
                        ? "bg-amber-50 text-amber-700"
                        : "bg-rose-50 text-rose-700")
                  }
                >
                  {ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : refunded ? (
                    <RotateCcw className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {statusLabel}
                </span>
              </div>
            </div>

            {/* Meta grid */}
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Receipt number
                </p>
                <p className="mt-1 break-all font-mono text-sm text-ink-900">
                  {receiptRef(payment)}
                </p>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-ink-400">
                  Date issued
                </p>
                <p className="mt-1 text-sm text-ink-900">
                  {formatDateTime(payment.created_at)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Billed to
                </p>
                <p className="mt-1 text-sm text-ink-900">
                  {session.profile?.username || session.user.email}
                </p>
                <p className="text-sm text-ink-500">{session.user.email}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-ink-400">
                  Payment method
                </p>
                <p className="mt-1 text-sm text-ink-900">
                  {methodLabel(payment, meta)}
                  {payCurrency ? ` · paid in ${payCurrency}` : ""}
                </p>
              </div>
            </div>

            {/* Order details */}
            {detailRows.length > 0 && (
              <div className="mt-8 rounded-xl border border-ink-100 bg-ink-50/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Order details
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {detailRows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-sm text-ink-500">{k}</dt>
                      <dd className="text-right text-sm font-medium text-ink-900">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Line items */}
            <table className="mt-8 w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink-100">
                  <td className="py-3 pr-4 text-ink-800">{lineItem}</td>
                  <td className="py-3 text-right font-medium text-ink-900">
                    {money(amount, usdCurrency)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 text-right text-sm font-semibold text-ink-700">
                    Total
                  </td>
                  <td className="pt-3 text-right text-lg font-bold text-ink-900">
                    {money(amount, usdCurrency)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Settlement currency note */}
            {showCharge && (
              <p className="mt-3 rounded-lg bg-brand-50/70 px-3.5 py-2.5 text-xs text-ink-600">
                Settled as{" "}
                <span className="font-semibold text-ink-900">
                  {money(chargeAmount, chargeCurrency)}
                </span>{" "}
                the {usdCurrency} total above was converted at a live
                exchange rate
                {fxRate > 0 ? ` of ${fxRate.toFixed(4)} ${chargeCurrency}/${usdCurrency}` : ""}.
              </p>
            )}

            {/* Gateway invoice link */}
            {payment.invoice_url && (
              <p className="no-print mt-4 text-xs text-ink-500">
                <a
                  href={payment.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View the original gateway invoice
                </a>
              </p>
            )}

            {/* Footer */}
            <div className="mt-8 border-t border-ink-100 pt-5 text-xs leading-relaxed text-ink-400">
              <p>
                Thank you for your purchase. This receipt was generated
                automatically by {APP_NAME} and confirms a payment recorded on
                your account. Amounts are shown in {usdCurrency}; the ledger of
                record for this account is kept in {usdCurrency}.
              </p>
              <p className="mt-2">
                Questions about this charge? Contact support from your
                dashboard and quote receipt number{" "}
                <span className="font-mono text-ink-500">
                  {receiptRef(payment)}
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
