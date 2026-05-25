"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  Download,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Globe,
  ShieldAlert,
  ServerCog,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from "@/constants/plans";
import { useCopy } from "@/hooks/useCopy";

// ---- Shapes -----------------------------------------------------------

interface ProxyRow {
  id: string;
  proxy_type: "static_residential" | "rotating_residential" | "datacenter";
  country_code: string;
  city: string | null;
  ip_address: string;
  port: number | null;
  username: string | null;
  password: string | null;
  status: "active" | "suspended" | "released";
  is_active: boolean;
  started_at: string;
  last_checked_at: string | null;
  bandwidth_used: number | null;
  bandwidth_limit_gb: number | null;
  bandwidth_exceeded: boolean;
}

// Product-level descriptors only — the upstream provider is never named.
const TYPE_LABEL: Record<ProxyRow["proxy_type"], string> = {
  static_residential: "Static Residential",
  rotating_residential: "Rotating Residential",
  datacenter: "Datacenter",
};

const COUNTRY_NAME: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name]),
);

// Connection-string formats offered for copy / export.
const FORMATS = [
  { id: "ip_port_user_pass", label: "ip:port:user:pass" },
  { id: "user_pass_ip_port", label: "user:pass@ip:port" },
  { id: "ip_port", label: "ip:port" },
  { id: "http_url", label: "http://user:pass@ip:port" },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

function formatProxy(p: ProxyRow, fmt: FormatId): string {
  const host = p.ip_address;
  const port = p.port ?? "";
  const user = p.username ?? "";
  const pass = p.password ?? "";
  switch (fmt) {
    case "ip_port":
      return `${host}:${port}`;
    case "user_pass_ip_port":
      return `${user}:${pass}@${host}:${port}`;
    case "http_url":
      return `http://${user}:${pass}@${host}:${port}`;
    case "ip_port_user_pass":
    default:
      return `${host}:${port}:${user}:${pass}`;
  }
}

/** Human "time since" label for the Last checked column. */
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// ---- Page -------------------------------------------------------------

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<ProxyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ProxyRow["proxy_type"]>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [format, setFormat] = useState<FormatId>("ip_port_user_pass");
  const [revealed, setRevealed] = useState(false);

  const { copy, copied } = useCopy();
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxies/list", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load your proxies");
      setProxies(Array.isArray(json.proxies) ? json.proxies : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your proxies");
      setProxies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---- Derived ----
  const suspendedCount = useMemo(
    () => proxies.filter((p) => p.status === "suspended").length,
    [proxies],
  );
  const exceededCount = useMemo(
    () =>
      proxies.filter((p) => p.bandwidth_exceeded && p.status !== "suspended")
        .length,
    [proxies],
  );
  const activeCount = proxies.length - suspendedCount - exceededCount;
  const countryCount = useMemo(
    () => new Set(proxies.map((p) => p.country_code)).size,
    [proxies],
  );

  // Distinct countries present in the account, for the by-country filter.
  const countryOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of proxies) {
      m.set(p.country_code, COUNTRY_NAME[p.country_code] ?? p.country_code);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [proxies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proxies.filter((p) => {
      if (typeFilter !== "all" && p.proxy_type !== typeFilter) return false;
      if (countryFilter !== "all" && p.country_code !== countryFilter)
        return false;
      if (!q) return true;
      return (
        p.ip_address.toLowerCase().includes(q) ||
        (p.username ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        p.country_code.toLowerCase().includes(q) ||
        (COUNTRY_NAME[p.country_code] ?? "").toLowerCase().includes(q)
      );
    });
  }, [proxies, query, typeFilter, countryFilter]);

  const exportLines = useMemo(
    () => filtered.map((p) => formatProxy(p, format)).join("\n"),
    [filtered, format],
  );

  function copyRow(p: ProxyRow) {
    copy(formatProxy(p, format));
    setCopiedRow(p.id);
    setTimeout(() => setCopiedRow((id) => (id === p.id ? null : id)), 1500);
  }

  function exportTxt() {
    const blob = new Blob([exportLines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oforson-proxies-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const typeTabs: Array<{ id: "all" | ProxyRow["proxy_type"]; label: string }> = [
    { id: "all", label: "All" },
    { id: "static_residential", label: "Static Residential" },
    { id: "rotating_residential", label: "Rotating Residential" },
    { id: "datacenter", label: "Datacenter" },
  ];

  return (
    <>
      <PageHeader
        title="Your proxies"
        description="Every proxy allocated to your account. Copy or export them in your preferred format."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<ServerCog className="h-4 w-4" />} label="Total proxies" value={proxies.length} />
        <StatTile icon={<Check className="h-4 w-4" />} label="Active" value={activeCount} tone="emerald" />
        <StatTile
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Paused"
          value={suspendedCount}
          tone={suspendedCount > 0 ? "amber" : "ink"}
        />
        <StatTile icon={<Globe className="h-4 w-4" />} label="Countries" value={countryCount} />
      </div>

      {/* Past-due / grace banner */}
      {suspendedCount > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>
                {suspendedCount} prox{suspendedCount === 1 ? "y" : "ies"} paused.
              </strong>{" "}
              Your plan is past due — we&apos;re holding these exact IPs for 48 hours.
              Settle your invoice and they reactivate instantly.
            </span>
          </div>
          <Link href="/dashboard/billing">
            <Button size="sm" className="w-full sm:w-auto">
              Go to billing
            </Button>
          </Link>
        </div>
      )}

      {/* Bandwidth-exceeded banner */}
      {exceededCount > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>
              {exceededCount} prox{exceededCount === 1 ? "y" : "ies"} stopped.
            </strong>{" "}
            Their bandwidth allowance is used up — they resume when the plan
            renews, or buy a higher bandwidth tier to lift the cap.
          </span>
        </div>
      )}

      {/* Toolbar + table */}
      <Card className="mt-4">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search IP, username, city, country…"
                className="input pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {typeTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    typeFilter === t.id
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : "text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="input h-9 w-auto py-0 text-xs"
              aria-label="Filter by country"
            >
              <option value="all">All countries</option>
              {countryOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatId)}
              className="input h-9 w-auto py-0 text-xs"
              aria-label="Connection format"
            >
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(exportLines)}
              disabled={filtered.length === 0}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy all"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportTxt}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-ink-500">
              Loading your proxies…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-rose-600">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          ) : proxies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="rounded-2xl bg-ink-50 p-3 text-ink-400">
                <Inbox className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">No proxies yet</p>
                <p className="mt-1 text-sm text-ink-500">
                  Purchase a plan and your proxies will appear here automatically.
                </p>
              </div>
              <Link href="/dashboard/billing">
                <Button size="sm">Browse plans</Button>
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-ink-500">
              No proxies match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-2.5 font-medium">IP address</th>
                    <th className="px-4 py-2.5 font-medium">Port</th>
                    <th className="px-4 py-2.5 font-medium">Username</th>
                    <th className="px-4 py-2.5 font-medium">
                      <button
                        onClick={() => setRevealed((r) => !r)}
                        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink-600"
                      >
                        Password
                        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 font-medium">Country</th>
                    <th className="px-4 py-2.5 font-medium">City</th>
                    <th className="px-4 py-2.5 font-medium">Last checked</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const suspended = p.status === "suspended";
                    const exceeded = p.bandwidth_exceeded && !suspended;
                    const down = suspended || exceeded;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-ink-50 transition hover:bg-ink-50/60 ${
                          down ? "opacity-70" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-ink-900">{p.ip_address}</td>
                        <td className="px-4 py-2.5 font-mono text-ink-600">{p.port ?? "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-ink-600">{p.username ?? "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-ink-600">
                          {revealed ? (p.password ?? "—") : "••••••••"}
                        </td>
                        <td className="px-4 py-2.5 text-ink-600">
                          {COUNTRY_NAME[p.country_code] ?? p.country_code}
                        </td>
                        <td className="px-4 py-2.5 text-ink-600">{p.city ?? "—"}</td>
                        <td className="px-4 py-2.5 text-ink-500">
                          {timeAgo(p.last_checked_at)}
                        </td>
                        <td className="px-4 py-2.5 text-ink-600">{TYPE_LABEL[p.proxy_type]}</td>
                        <td className="px-4 py-2.5">
                          {suspended ? (
                            <Badge variant="warning">Paused</Badge>
                          ) : exceeded ? (
                            <Badge variant="danger">Stopped</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => copyRow(p)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                            aria-label="Copy proxy"
                          >
                            {copiedRow === p.id ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !error && filtered.length > 0 && (
        <p className="mt-3 text-xs text-ink-400">
          Showing {filtered.length} of {proxies.length} proxies · format{" "}
          <span className="font-mono">{FORMATS.find((f) => f.id === format)?.label}</span>
        </p>
      )}
    </>
  );
}

// ---- Stat tile --------------------------------------------------------

function StatTile({
  icon,
  label,
  value,
  tone = "ink",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "ink" | "emerald" | "amber";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-ink-400";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-xl bg-ink-50 p-2 ${toneCls}`}>{icon}</div>
        <div>
          <p className="text-xs text-ink-500">{label}</p>
          <p className="text-xl font-semibold text-ink-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
