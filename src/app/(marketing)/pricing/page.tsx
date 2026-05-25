import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <>
      <section className="py-24 text-center bg-noise">
        <div className="container mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Pricing</p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight text-ink-900">
            Pay only for what you use.
          </h1>
          <p className="mt-4 max-w-xl mx-auto text-lg text-ink-600">
            Every order is priced live from real upstream cost — and volume
            pricing means the more you buy, the less you pay per unit.
          </p>
        </div>
      </section>
      <Pricing />
      <FAQ />
    </>
  );
}
