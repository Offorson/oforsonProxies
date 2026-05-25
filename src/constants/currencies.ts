/**
 * Paystack currency catalogue (UI side).
 *
 * The currencies Paystack can charge in. A given Paystack account only
 * settles the currencies it has been enabled for (depends on the account's
 * country); Paystack rejects the rest. Restrict what the buying panel offers
 * with NEXT_PUBLIC_PAYSTACK_CURRENCIES (comma-separated list of codes).
 *
 * subunitFactor: multiply a major amount by this for the integer Paystack
 * expects. Zero-decimal currencies (XOF, RWF) use a factor of 1.
 *
 * Keep in sync with supabase/functions/_shared/currencies.ts.
 */
export interface PaystackCurrency {
  code: string;
  name: string;
  symbol: string;
  subunitFactor: number;
}

export const PAYSTACK_CURRENCIES: PaystackCurrency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", subunitFactor: 100 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", subunitFactor: 100 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", subunitFactor: 100 },
  { code: "ZAR", name: "South African Rand", symbol: "R", subunitFactor: 100 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", subunitFactor: 100 },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", subunitFactor: 100 },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA", subunitFactor: 1 },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", subunitFactor: 1 },
];

/**
 * Currencies the buying panel should offer. Restricted by the
 * NEXT_PUBLIC_PAYSTACK_CURRENCIES env var when set, otherwise all of them.
 */
export function enabledPaystackCurrencies(): PaystackCurrency[] {
  const raw = process.env.NEXT_PUBLIC_PAYSTACK_CURRENCIES;
  if (!raw) return PAYSTACK_CURRENCIES;
  const allow = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const filtered = PAYSTACK_CURRENCIES.filter((c) => allow.includes(c.code));
  return filtered.length > 0 ? filtered : PAYSTACK_CURRENCIES;
}

export function findPaystackCurrency(code: string): PaystackCurrency | undefined {
  const c = String(code ?? "").trim().toUpperCase();
  return PAYSTACK_CURRENCIES.find((x) => x.code === c);
}
