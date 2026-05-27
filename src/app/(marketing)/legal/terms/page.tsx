export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="py-24">
      <div className="container mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: May 24, 2026</p>
        <div className="mt-10 space-y-8 text-ink-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-ink-900">1. Acceptance of Terms</h2>
            <p className="mt-2">
              These Terms of Service govern your access to and use of Oforson Proxies
              (the &ldquo;Service&rdquo;). By creating an account, purchasing a plan, or otherwise
              using the Service, you agree to be bound by these Terms. If you are using the Service
              on behalf of an organization, you represent that you have authority to bind that
              organization. If you do not agree, do not use the Service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">2. About the Service</h2>
            <p className="mt-2">
              Oforson Proxies provides access to residential, ISP, and datacenter proxy
              infrastructure together with a dashboard for configuring, generating, and managing
              proxies. Proxy capacity is delivered through an upstream proxy network provider.
              Your use of the proxies is therefore also subject to the acceptable-use and
              restricted-activity rules of that upstream provider, which we pass through to you
              in Section 4.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">3. Eligibility &amp; Accounts</h2>
            <p className="mt-2">
              You must be at least 18 years old and capable of forming a binding contract to use
              the Service. You are responsible for maintaining the confidentiality of your
              credentials and for all activity under your account.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">4. Acceptable Use</h2>
            <p className="mt-2">
              You may not use the Service for illegal activities, spamming, credential stuffing,
              DDOS attacks, or any activity prohibited by our upstream provider. We reserve the
              right to suspend accounts that violate these rules without refund.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">5. Billing &amp; Refunds</h2>
            <p className="mt-2">
              All sales are final. Proxies are provisioned immediately upon payment and cannot
              be returned. If you experience a service failure attributable to us, contact
              support within 7 days for a credit review.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">6. Limitation of Liability</h2>
            <p className="mt-2">
              The Service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law,
              Oforson Proxies is not liable for indirect, incidental, or consequential damages.
              Our total liability is capped at the amount you paid in the 30 days prior to the claim.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">7. Changes to Terms</h2>
            <p className="mt-2">
              We may update these Terms at any time. Continued use after changes are posted
              constitutes acceptance. We will notify registered users by email for material changes.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink-900">8. Contact</h2>
            <p className="mt-2">
              Questions: <a href="mailto:hello@oforson.dev" className="underline">hello@oforson.dev</a>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
