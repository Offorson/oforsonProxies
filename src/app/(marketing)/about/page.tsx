export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="py-24">
      <div className="container mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">About</p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight text-ink-900">
          We're building the internet's most reliable proxy backbone.
        </h1>
        <p className="mt-6 text-lg text-ink-600 leading-relaxed">
          Oforson Proxies makes residential, ISP, and datacenter proxy infrastructure
          accessible to teams that depend on accurate, geo-aware data — with transparent,
          usage-based pricing and a dashboard that is genuinely pleasant to use.
        </p>
        <p className="mt-4 text-lg text-ink-600 leading-relaxed">
          We are an independent, early-stage team. The platform is in active development
          as we onboard our first customers — if that is you, we would love your feedback.
        </p>
      </div>
    </section>
  );
}
