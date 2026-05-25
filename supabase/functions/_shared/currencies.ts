// =============================================================
// Paystack currency catalogue  (Supabase Edge Functions / Deno)
// -------------------------------------------------------------
// The currencies Paystack is able to charge in. A given Paystack
// account can only actually settle the currencies it has been
// enabled for (this depends on the account's country) — Paystack
// rejects the rest, and the checkout function surfaces that error.
//
// subunitFactor: multiply a major-unit amount by this to get the
// integer `amount` Paystack expects (kobo / pesewas / cents …).
// Zero-decimal currencies (XOF, RWF) use a factor of 1.
//
// Keep in sync with src/constants/currencies.ts.
// =============================================================

export interface PaystackCurrency {
  code: string;
  name: string;
  subunitFactor: number;
}

export const PAYSTACK_CURRENCIES: PaystackCurrency[] = [
  { code: "USD", name: "US Dollar", subunitFactor: 100 },
  { code: "NGN", name: "Nigerian Naira", subunitFactor: 100 },
  { code: "GHS", name: "Ghanaian Cedi", subunitFactor: 100 },
  { code: "ZAR", name: "South African Rand", subunitFactor: 100 },
  { code: "KES", name: "Kenyan Shilling", subunitFactor: 100 },
  { code: "EGP", name: "Egyptian Pound", subunitFactor: 100 },
  { code: "XOF", name: "West African CFA Franc", subunitFactor: 1 },
  { code: "RWF", name: "Rwandan Franc", subunitFactor: 1 },
];

/** Look up a currency by ISO code (case-insensitive). */
export function findPaystackCurrency(code: string): PaystackCurrency | undefined {
  const c = String(code ?? "").trim().toUpperCase();
  return PAYSTACK_CURRENCIES.find((x) => x.code === c);
}

// =============================================================
// Payment channels
// -------------------------------------------------------------
// The Paystack channels to enable on the hosted checkout, per
// settlement currency. Passing `channels` to /transaction/initialize
// restricts the checkout to exactly that list.
//
// "Pay with Transfer" (`bank_transfer`) is a Nigeria-only feature,
// so it is offered only for NGN. Other markets fall back to the
// methods Paystack actually supports there (mobile money, EFT, card).
// A currency that is not listed returns `undefined` — the caller then
// omits `channels` entirely and lets Paystack fall back to whatever
// the account has enabled.
//
// Channel reference: https://paystack.com/docs/payments/payment-channels/
// =============================================================
const PAYSTACK_CHANNELS: Record<string, string[]> = {
  NGN: ["card", "bank", "bank_transfer", "ussd", "qr"],
  GHS: ["card", "mobile_money"],
  KES: ["card", "mobile_money"],
  ZAR: ["card", "eft"],
  USD: ["card"],
};

/**
 * The Paystack channels to enable for a settlement currency, or
 * `undefined` when the currency has no explicit list (the caller should
 * then omit `channels` and let the account defaults apply).
 */
export function paystackChannelsForCurrency(
  code: string,
): string[] | undefined {
  const c = String(code ?? "").trim().toUpperCase();
  return PAYSTACK_CHANNELS[c];
}
