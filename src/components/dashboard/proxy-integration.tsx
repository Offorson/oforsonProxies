"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Code2, Terminal } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useCopy } from "@/hooks/useCopy";

interface ProxyRow {
  ip_address: string;
  port: number | null;
  username: string | null;
  password: string | null;
  status: "active" | "suspended" | "released";
  bandwidth_exceeded?: boolean;
}

const LANGS = ["cURL", "Python", "Node.js", "PHP"] as const;
type Lang = (typeof LANGS)[number];

/** A neutral IP-echo endpoint used in every quickstart snippet. */
const TEST_URL = "https://api.ipify.org?format=json";

function snippet(lang: Lang, host: string, port: string, user: string, pass: string): string {
  const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
  switch (lang) {
    case "cURL":
      return `curl --proxy "${proxyUrl}" "${TEST_URL}"`;
    case "Python":
      return [
        `import requests`,
        ``,
        `proxy = "${proxyUrl}"`,
        `resp = requests.get(`,
        `    "${TEST_URL}",`,
        `    proxies={"http": proxy, "https": proxy},`,
        `)`,
        `print(resp.json())`,
      ].join("\n");
    case "Node.js":
      return [
        `// npm install https-proxy-agent`,
        `import { HttpsProxyAgent } from "https-proxy-agent";`,
        ``,
        `const agent = new HttpsProxyAgent("${proxyUrl}");`,
        `const res = await fetch("${TEST_URL}", { agent });`,
        `console.log(await res.json());`,
      ].join("\n");
    case "PHP":
      return [
        `<?php`,
        `$ch = curl_init("${TEST_URL}");`,
        `curl_setopt($ch, CURLOPT_PROXY, "${proxyUrl}");`,
        `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`,
        `echo curl_exec($ch);`,
        `curl_close($ch);`,
      ].join("\n");
    default:
      return "";
  }
}

export function ProxyIntegration() {
  const [proxy, setProxy] = useState<ProxyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>("cURL");
  const { copy, copied } = useCopy();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/proxies/list", { cache: "no-store" });
        const json = await res.json();
        const list: ProxyRow[] = Array.isArray(json.proxies) ? json.proxies : [];
        // Prefer a live, usable proxy; fall back to the first with creds.
        const usable =
          list.find(
            (p) =>
              p.status === "active" &&
              !p.bandwidth_exceeded &&
              p.username &&
              p.password &&
              p.port,
          ) ?? list.find((p) => p.username && p.password && p.port) ?? null;
        if (!cancelled) setProxy(usable);
      } catch {
        if (!cancelled) setProxy(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const code = useMemo(() => {
    if (!proxy) return "";
    return snippet(
      lang,
      proxy.ip_address,
      String(proxy.port ?? ""),
      proxy.username ?? "",
      proxy.password ?? "",
    );
  }, [proxy, lang]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-600 text-white">
            <Code2 className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>Proxy integration</CardTitle>
            <CardDescription>
              Quickstart — see your first proxy working in seconds. Run this in
              your terminal or app.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-ink-100" />
        ) : !proxy ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 py-10 text-center">
            <Terminal className="h-6 w-6 text-ink-400" />
            <div>
              <p className="text-sm font-medium text-ink-900">
                No proxies to integrate yet
              </p>
              <p className="mt-1 text-sm text-ink-500">
                Buy a proxy and your ready-to-run code snippets appear here.
              </p>
            </div>
            <Link href="/dashboard/billing" className="btn-primary h-9">
              Buy proxies
            </Link>
          </div>
        ) : (
          <>
            {/* Language tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-ink-100 pb-3">
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    lang === l
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : "text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div className="relative mt-3">
              <button
                onClick={() => copy(code)}
                className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-ink-100 transition hover:bg-ink-700"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <pre className="overflow-x-auto rounded-xl bg-ink-900 p-4 pr-20 text-xs leading-relaxed text-ink-100">
                <code>{code}</code>
              </pre>
            </div>

            <p className="mt-2 text-xs text-ink-400">
              Using proxy{" "}
              <span className="font-mono text-ink-600">
                {proxy.ip_address}:{proxy.port}
              </span>{" "}
              · the request returns the proxy&apos;s exit IP so you can confirm
              it works.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
