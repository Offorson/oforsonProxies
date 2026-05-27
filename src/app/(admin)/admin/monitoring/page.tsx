import { Activity, AlertTriangle, Server, Zap } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { AreaChart } from "@/components/charts/area-chart";
import { Badge } from "@/components/ui/badge";

const LATENCY = Array.from({ length: 24 }).map((_, i) => ({
  name: `${i}:00`,
  ms: Math.round(110 + Math.sin(i / 3) * 20 + Math.random() * 12)
}));

const ERRORS = Array.from({ length: 24 }).map((_, i) => ({
  name: `${i}:00`,
  err: Math.round(Math.max(0, Math.random() * 6 - (i > 12 ? 2 : 0)))
}));

export const metadata = { title: "Admin · Monitoring" };

export default function MonitoringPage() {
  return (
    <>
      <PageHeader title="System monitoring" description="Real-time platform telemetry." />

      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="API latency P50" value="124 ms" delta={-3.2} icon={<Zap className="h-5 w-5" />} />
        <Stat label="API latency P99" value="412 ms" delta={1.4} icon={<Activity className="h-5 w-5" />} />
        <Stat label="Server health" value="OK" delta={0} icon={<Server className="h-5 w-5" />} />
        <Stat label="Error rate" value="0.42%" delta={-0.18} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API latency 24h</CardTitle>
            <CardDescription>P50, milliseconds</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChart data={LATENCY} dataKey="ms" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Errors 24h</CardTitle>
            <CardDescription>Errors per minute</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChart data={ERRORS} dataKey="err" color="#f43f5e" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Service health</CardTitle>
          <CardDescription>Upstream & internal dependencies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { s: "API gateway", v: "120ms", ok: true },
            { s: "Residential network", v: "98ms", ok: true },
            { s: "Datacenter network", v: "142ms", ok: true },
            { s: "Stripe billing", v: "210ms", ok: true },
            { s: "Email delivery", v: "Healthy", ok: true },
            { s: "Background workers", v: "Lag 12ms", ok: true }
          ].map((r) => (
            <div key={r.s} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulseDot" />
                <p className="text-sm text-ink-800">{r.s}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-500">{r.v}</span>
                <Badge variant="success">Operational</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
