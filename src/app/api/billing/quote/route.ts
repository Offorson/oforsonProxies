import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceCheckout, type ConfigurationRule } from "@/lib/pricing/calculator";
import { convertUsd, fxOptionsFromEnv } from "@/lib/pricing/fx";
import { findPaystackCurrency } from "@/constants/currencies";

export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.enum(["static_residential", "rotating_residential", "datacenter"]),
  qty: z.number().int().min(1).max(100000).optional().default(1),
  gb: z.number().int().min(0).max(100000).optional(),
  dedicated: z.boolean().optional().default(false),
  exclusivity: z.enum(["shared", "private", "dedicated"]).optional(),
  country: z.string().min(2).max(2).or(z.literal("WW")).optional().default("WW"),
  unlimited: z.boolean().optional().default(false),
  standardGb: z.number().int().positive().max(100000).optional(),
  proxyReplacements: z.number().int().min(0).max(100000).optional(),
  automaticRefreshFrequency: z.number().int().min(0).max(100000000).optional(),
  highPriorityNetwork: z.boolean().optional(),
  currency: z.string().min(3).max(3).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const input = Body.parse(await request.json());
    const admin = createAdminClient();

    const { data: rule, error: ruleErr } = await admin
      .from("proxy_configuration_rules")
      .select("*")
      .eq("product_type", input.type)
      .eq("is_active", true)
      .maybeSingle<ConfigurationRule & { is_active: boolean }>();

    if (ruleErr) {
      throw new Error(`Could not load pricing rule: ${ruleErr.message}`);
    }
    if (!rule) {
      return NextResponse.json(
        { error: `No active pricing rule for ${input.type}` },
        { status: 404 }
      );
    }

    const breakdown = await priceCheckout(rule, input, {
      apiKey: process.env.WEBSHARE_API_KEY ?? "",
      baseUrl: process.env.WEBSHARE_BASE_URL,
    });

    void admin
      .from("proxy_configuration_rules")
      .update({
        last_wholesale_cost: breakdown.wholesaleCost,
        last_quote_at: new Date().toISOString(),
      })
      .eq("product_type", input.type)
      .then(() => undefined, () => undefined);

    let charge:
      | {
          currency: string;
          amount: number;
          rate: number;
          bufferPct: number;
          source: string;
        }
      | undefined;
    const wanted = input.currency
      ? findPaystackCurrency(input.currency)
      : undefined;
    if (wanted && wanted.code !== "USD") {
      try {
        const fx = await convertUsd(
          breakdown.retailPrice,
          wanted.code,
          fxOptionsFromEnv()
        );
        charge = {
          currency: fx.currency,
          amount: fx.amount,
          rate: fx.rate,
          bufferPct: fx.bufferPct,
          source: fx.source,
        };
      } catch {
        charge = undefined;
      }
    }

    return NextResponse.json({
      ok: true,
      quote: {
        productType: breakdown.productType,
        displayLabel: breakdown.displayLabel,
        billingUnit: breakdown.billingUnit,
        quantity: breakdown.quantity,
        gb: breakdown.gb,
        dedicated: breakdown.dedicated,
        exclusivity: breakdown.exclusivity,
        country: breakdown.country,
        unlimitedBandwidth: breakdown.unlimitedBandwidth,
        standardGb: breakdown.standardGb,
        term: breakdown.term,
        retailPrice: breakdown.retailPrice,
        currency: breakdown.currency,
        charge,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
