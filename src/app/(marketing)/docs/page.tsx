export const metadata = { title: "Documentation" };

export default function DocsPage() {
  return (
    <section className="py-24">
      <div className="container mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Docs</p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight text-ink-900">API & Documentation</h1>
        <p className="mt-4 text-lg text-ink-600">
          Everything you need to integrate Oforson Proxies into your stack.
        </p>

        <div className="mt-12 space-y-12">
          <section id="quickstart">
            <h2 className="text-2xl font-semibold text-ink-900">Quickstart</h2>
            <p className="mt-2 text-ink-600">Generate a proxy with a single REST call:</p>
            <pre className="mt-4 rounded-2xl bg-ink-900 p-5 text-sm text-emerald-300 overflow-x-auto">
{`curl -X POST https://api.oforson.dev/v1/proxies/generate \\
  -H "Authorization: Bearer $OFORSON_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "rotating_residential",
    "country": "US",
    "session_id": "abc123"
  }'`}
            </pre>
          </section>

          <section id="api">
            <h2 className="text-2xl font-semibold text-ink-900">API Reference</h2>
            <p className="mt-2 text-ink-600">All endpoints are versioned at <code>/v1</code>. Authenticate with a Bearer token.</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-700">
              <li><code className="rounded bg-ink-100 px-2 py-0.5">POST /v1/proxies/generate</code> Generate a proxy</li>
              <li><code className="rounded bg-ink-100 px-2 py-0.5">GET /v1/proxies</code> List proxies</li>
              <li><code className="rounded bg-ink-100 px-2 py-0.5">GET /v1/usage</code> Bandwidth usage</li>
              <li><code className="rounded bg-ink-100 px-2 py-0.5">POST /v1/keys</code> Create API key</li>
            </ul>
          </section>

          <section id="status">
            <h2 className="text-2xl font-semibold text-ink-900">Status</h2>
            <p className="mt-2 text-ink-600 inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulseDot" />
              All systems operational
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
