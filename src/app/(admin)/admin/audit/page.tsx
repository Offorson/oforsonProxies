"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: string;
  admin_user_id: string;
  affected_user_id: string | null;
  action_type: string;
  description: string;
  ip_address: string | null;
  created_at: string;
  // joined profile emails (may be present if API expands them)
  admin_email?: string;
  affected_email?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audit?limit=100");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { logs: AuditLog[] };
      setLogs(json.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Tamper-evident trail of every administrative action."
        actions={
          <Button variant="outline" size="md" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-6 py-3">When</th>
                <th className="px-6 py-3">Admin</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Target</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-400">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading logs…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-rose-600">{error}</td>
                </tr>
              )}
              {!loading && !error && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-ink-400">
                    No audit log entries yet.
                  </td>
                </tr>
              )}
              {!loading && logs.map((l) => (
                <tr key={l.id} className="hover:bg-ink-50/40">
                  <td className="px-6 py-4 text-ink-500 whitespace-nowrap">{timeAgo(l.created_at)}</td>
                  <td className="px-6 py-4 text-ink-800 font-mono text-xs">
                    {l.admin_email ?? l.admin_user_id.slice(0, 8) + "…"}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="brand">{l.action_type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-ink-700 text-xs">
                    {l.affected_email ?? (l.affected_user_id ? l.affected_user_id.slice(0, 8) + "…" : "-")}
                  </td>
                  <td className="px-6 py-4 text-ink-700">{l.description}</td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-500">{l.ip_address ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
