import Link from "next/link";
import { Check, ArrowRight, TrendingDown } from "lucide-react";

interface Props {
  slug: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  features: string[];
}

export function ProductDetail({ eyebrow, title, subtitle, features }: Props) {
  return (
    <>
      <section className="py-24 bg-noise">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-5xl sm:text-6xl font-bold tracking-tight text-ink-900 text-balance">
            {title}
          </h1>
          <p className="mt-6 text-lg text-ink-600 max-w-2xl mx-auto">{subtitle}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary h-12 px-6">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="btn-outline h-12 px-6">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f}
                className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-soft"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm text-ink-800 font-medium">{f}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center sm:flex-row sm:text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <TrendingDown className="h-5 w-5" />
            </span>
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">
                The more you buy, the less you pay.
              </span>{" "}
              Volume pricing is applied automatically at checkout — every extra
              IP or GB you add lowers your per-unit rate.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
