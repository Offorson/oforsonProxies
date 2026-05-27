export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="py-24">
      <div className="container mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: May 24, 2026</p>
        <div className="mt-10 space-y-8 text-ink-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-ink-900">Data we collect</h2>
            <p className="mt-2">
              Account details (email, name), billing information, usage telemetry (bandwidth, country
              mix, error rates), and product analytics. We do not log the contents of proxied traffic.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">How we use it</h2>
            <p className="mt-2">
              To provide the service, enforce limits, prevent abuse, and improve product quality.
              GDPR-eligible users may request export or deletion at any time.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">Sub-processors</h2>
            <p className="mt-2">
              Supabase (database &amp; authentication), Paystack and NOWPayments (payment
              processing), and our upstream proxy network provider. Each is bound by a
              data processing agreement.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">Cookies</h2>
            <p className="mt-2">
              We use essential session cookies only. No advertising or tracking cookies.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">Contact</h2>
            <p className="mt-2">
              Privacy questions: <a href="mailto:hello@oforson.dev" className="underline">hello@oforson.dev</a>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
