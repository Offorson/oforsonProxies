import Link from "next/link";
import { Download, Receipt, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckoutPanel } from "@/components/billing/checkout-panel";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_url: string | null;
  invoice_id: string | null;
  description: string | null;
  payment_method: string | null;
  created_at: string;
}

function money(amount: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return amount.toLocaleString("en-US", { style: "currency", currency: code });
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A short, human-friendly reference for a payment row. */
function invoiceRef(p: PaymentRow): string {
  if (p.invoice_id) return p.invoice_id;
  return p.id.slice(0, 8).toUpperCase();
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  const { status } = await searchParams;

  // Live invoice history every settled / failed / refunded payment for
  // this account, newest first. No hardcoded rows.
  let invoices: PaymentRow[] = [];
  if (session?.user.id) {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from("payment_history")
      .select(
        "id, amount, currency, status, invoice_url, invoice_id, description, payment_method, created_at"
      )
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    invoices = (data as PaymentRow[] | null) ?? [];
  }

  return (
    <>
      <PageHeader
        title="Billing"
        description="Buy proxies and review every payment on your account."
      />

      {status === "success" && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Payment received. Your proxies are being provisioned and will
            appear in your account shortly.
          </span>
        </div>
      )}
      {status === "cancelled" && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Checkout was cancelled no charge was made. You can start a new
            order any time.
          </span>
        </div>
      )}

      <CheckoutPanel userId={session?.user.id ?? ""} />

      <div id="invoices" className="mt-6 scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoice history</CardTitle>
                <CardDescription>
                  Every payment on your account · downloadable receipts
                </CardDescription>
              </div>
              {invoices.length > 0 && (
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Export all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="rounded-2xl bg-ink-50 p-3 text-ink-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    No invoices yet
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    Your payments will appear here automatically after your
                    first purchase.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th className="py-3">Invoice</th>
                      <th className="py-3">Date</th>
                      <th className="py-3">Amount</th>
                      <th className="py-3">Status</th>
                      <th className="py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {invoices.map((inv) => {
                      const ok = inv.status === "succeeded";
                      const refunded = inv.status === "refunded";
                      return (
                        <tr key={inv.id}>
                          <td className="py-3">
                            <span className="font-mono text-xs text-ink-700">
                              {invoiceRef(inv)}
                            </span>
                            {inv.description && (
                              <p className="mt-0.5 max-w-xs truncate text-xs text-ink-400">
                                {inv.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3 text-ink-700">
                            {formatDate(inv.created_at)}
                          </td>
                          <td className="py-3 font-medium text-ink-900">
                            {money(Number(inv.amount), inv.currency)}
                          </td>
                          <td className="py-3">
                            <Badge
                              variant={
                                ok
                                  ? "success"
                                  : refunded
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {ok
                                ? "Paid"
                                : refunded
                                  ? "Refunded"
                                  : "Failed"}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <Link href={`/dashboard/billing/receipt/${inv.id}`}>
                              <Button variant="ghost" size="sm">
                                <Receipt className="h-4 w-4" /> View receipt
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
