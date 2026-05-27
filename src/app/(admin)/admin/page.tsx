import { Users, DollarSign, Server, Activity } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Badge } from "@/components/ui/badge";

const REVENUE = Array.from({ length: 12 }).map((_, i) => ({
  name: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  usd: 40000 + Math.round(Math.random() * 20000 + i * 2500)
}));

const SIGNUPS = Array.from({ length: 14 }).map((_, i) => ({
  name: `D${i + 1}`,
  users: 12 + Math.round(Math.random() * 18)
}));

export const metadata = { title: "Admin · Overview" };

export default function AdminOverview() {
  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Platform health and business metrics at a glance."
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value="$84.2K" delta={11.2} hint="vs last month" icon={<DollarSign className="h-5 w-5" />} />
        <Stat label="Active users" value="3,482" delta={8.4} hint="last 30d" icon={<Users className="h-5 w-5" />} />
        <Stat label="Bandwidth served" value="42.8 TB" delta={14.1} hint="this month" icon={<Server className="h-5 w-5" />} />
        <Stat label="API uptime" value="99.99%" delta={0.0} hint="stable" icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue last 12 months</CardTitle>
                <CardDescription>MRR + one-time charges</CardDescription>
              </div>
              <Badge variant="success">+38% YoY</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AreaChart data={REVENUE} dataKey="usd" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signups last 14 days</CardTitle>
            <CardDescription>New activations / day</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={SIGNUPS} dataKey="users" color="#22d3ee" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent signups</CardTitle>
            <CardDescription>Newest accounts in the last 24h</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { n: "Lia Becker", e: "lia@beck.io", p: "Pro" },
              { n: "Felix Romero", e: "felix@quanta.com", p: "Starter" },
              { n: "Ada Lin", e: "ada@cloudgrid.dev", p: "Business" },
              { n: "Mateo Cruz", e: "mateo@reply.io", p: "Pro" }
            ].map((u, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl p-2 hover:bg-ink-50">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-blue-600 text-xs font-semibold text-white">
                    {u.n.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{u.n}</p>
                    <p className="text-xs text-ink-500">{u.e}</p>
                  </div>
                </div>
                <Badge variant="brand">{u.p}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>All systems operational</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { s: "API gateway", v: "120ms", ok: true },
              { s: "Residential network", v: "98ms", ok: true },
              { s: "Datacenter network", v: "142ms", ok: true },
              { s: "Stripe billing", v: "210ms", ok: true },
              { s: "Email delivery", v: "Healthy", ok: true }
            ].map((r) => (
              <div key={r.s} className="flex items-center justify-between rounded-xl p-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulseDot" />
                  <p className="text-sm text-ink-800">{r.s}</p>
                </div>
                <span className="text-xs font-medium text-ink-500">{r.v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
