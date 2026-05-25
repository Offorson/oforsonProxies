export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="py-24 prose-content">
      <div className="container mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: May 24, 2026</p>

        <div className="mt-10 space-y-8 text-ink-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-ink-900">1. Acceptance of Terms</h2>
            <p className="mt-2">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of
              Oforson Proxies (the &ldquo;Service&rdquo;). By creating an account, purchasing a
              plan, or otherwise using the Service, you agree to be bound by these Terms. If you
              are using the Service on behalf of an organization, you represent that you have
              authority to bind that organization. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">2. About the Service</h2>
            <p className="mt-2">
              Oforson Proxies provides access to residential, ISP, and datacenter proxy
              infrastructure together with a dashboard for configuring, generating, and
              managing proxies. Proxy capacity is delivered through an upstream proxy network
              provider. Your use of the proxies is therefore also subject to the acceptable-use
              and restricted-activity rules of that upstream provider, which we pass through to
              you in Section 4.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">3. Eligibility &amp; Accounts</h2>
            <p className="mt-2">
              You must be at least 18 years old and able to form a binding contract to use the
              Service. You are responsible for the accuracy of your account information, for
              keeping your credentials secure, and for all activity that occurs under your
              account. We may require identity verification before activating, continuing, or
              expanding service, and may decline or limit accounts at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">4. Acceptable Use Policy</h2>
            <p className="mt-2">
              You may not use the Service, and you may not allow anyone else to use the Service,
              for any unlawful, harmful, or abusive purpose. Prohibited activities include, but
              are not limited to:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Fraud, carding, payment-fraud testing, or abuse of payment-verification systems.</li>
              <li>Credential stuffing, account-takeover attempts, or mass creation of accounts on third-party platforms.</li>
              <li>Accessing or attempting to breach systems, networks, or accounts without authorization, including vulnerability scanning, stress testing, or denial-of-service attacks.</li>
              <li>Distributing malware, phishing content, or spam, or interacting with known spam or malicious domains.</li>
              <li>Ticketing abuse, scalping, click fraud, or generating fake ad or media views.</li>
              <li>Accessing, downloading, or distributing pirated or copyright-infringing material.</li>
              <li>Collecting non-public, sensitive, or personal data without a lawful basis or required consent.</li>
              <li>Targeting government, financial, or other sensitive or protected systems in violation of law or their terms.</li>
              <li>Any activity that violates applicable law, regulation, or third-party rights, or the terms of our upstream provider.</li>
            </ul>
            <p className="mt-3">
              We may monitor for, investigate, and act on suspected violations. Suspected abuse
              may lead to identity-verification requirements, rate limiting, suspension, or
              permanent termination, with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">5. No Resale or Redistribution</h2>
            <p className="mt-2">
              The Service is licensed for your own use. You may not resell, sublicense, share,
              or otherwise redistribute proxy access or credentials to third parties without our
              prior written consent. Accounts found redistributing access may be suspended or
              terminated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">6. Pricing, Billing &amp; Payment</h2>
            <p className="mt-2">
              Prices are quoted live in the dashboard. The amount you pay reflects the
              configuration you select (product, quantity or bandwidth, add-ons) and is
              calculated from current upstream cost; prices may therefore change between
              sessions. The total is recomputed and verified before you are charged. Payments
              are accepted via supported card, bank-transfer, and cryptocurrency methods, and
              non-USD charges are converted at prevailing exchange rates. Recurring plans renew
              until cancelled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">7. Refunds</h2>
            <p className="mt-2">
              Because proxy capacity is provisioned from a paid upstream provider as soon as an
              order is placed, payments are generally non-refundable once proxies have been
              issued. If you believe you were charged in error, contact us and we will review
              the request in good faith. Cryptocurrency payments, once confirmed on-chain,
              cannot be reversed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">8. Service Availability</h2>
            <p className="mt-2">
              The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
              basis and is under active development. We do not currently offer a guaranteed
              uptime service level. Proxy performance depends on upstream networks and target
              websites and may vary. We may modify, suspend, or discontinue features at any
              time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">9. Suspension &amp; Termination</h2>
            <p className="mt-2">
              We may suspend or terminate your account for violation of these Terms, for
              suspected prohibited activity, for non-payment, or where required to comply with
              law or the requirements of our upstream provider. You may stop using the Service
              and close your account at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">10. Intellectual Property</h2>
            <p className="mt-2">
              The Oforson Proxies platform, dashboard, branding, and content are owned by
              Oforson Proxies and protected by applicable law. These Terms grant you a limited,
              non-exclusive, non-transferable right to use the Service; no other rights are
              granted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">11. Disclaimers</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, the Service is provided without warranties
              of any kind, whether express or implied, including warranties of merchantability,
              fitness for a particular purpose, and non-infringement. We do not warrant that the
              Service will be uninterrupted, error-free, or that any proxy will succeed against
              a given target.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">12. Limitation of Liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, Oforson Proxies will not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or for loss of
              profits, data, or goodwill. Our total liability for any claim relating to the
              Service will not exceed the amount you paid to us for the Service in the three
              months preceding the event giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">13. Indemnification</h2>
            <p className="mt-2">
              You agree to defend, indemnify, and hold harmless Oforson Proxies from any claims,
              damages, liabilities, and costs arising out of your use of the Service or your
              violation of these Terms or of any applicable law or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">14. Changes to These Terms</h2>
            <p className="mt-2">
              We may update these Terms from time to time. Material changes will be reflected by
              updating the &ldquo;Last updated&rdquo; date above. Your continued use of the
              Service after changes take effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">15. Contact</h2>
            <p className="mt-2">
              Questions about these Terms can be sent to{" "}
              <a href="mailto:support@oforson.dev" className="text-brand-600 font-medium">
                support@oforson.dev
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
