import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Admin · Inventory" };

const POOL = [
  { c: "United States", code: "US", ips: 8_420_000, uptime: 99.99 },
  { c: "Germany", code: "DE", ips: 3_120_000, uptime: 99.98 },
  { c: "United Kingdom", code: "GB", ips: 2_840_000, uptime: 99.97 },
  { c: "Brazil", code: "BR", ips: 1_960_000, uptime: 99.95 },
  { c: "Japan", code: "JP", ips: 1_710_000, uptime: 99.99 },
  { c: "India", code: "IN", ips: 1_590_000, uptime: 99.93 },
  { c: "Singapore", code: "SG", ips: 980_000, uptime: 99.98 },
  { c: "Australia", code: "AU", ips: 740_000, uptime: 99.97 }
];

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Proxy inventory"
        description="Health and distribution of every IP pool you operate."
      />

      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="Total IPs" value="45.2M" delta={2.1} hint="across all pools" />
        <Stat label="Avg uptime" value="99.97%" delta={0.02} />
        <Stat label="Active sessions" value="12,438" delta={4.4} hint="live" />
        <Stat label="Mean latency" value="124 ms" delta={-3.2} hint="P50" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Country distribution</CardTitle>
          <CardDescription>Per-country IP pools and uptime</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {POOL.map((p) => (
              <div key={p.code} className="rounded-xl border border-ink-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-xs font-bold text-ink-700">
                      {p.code}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-900">{p.c}</p>
                      <p className="text-xs text-ink-500">
                        {(p.ips / 1_000_000).toFixed(2)}M IPs
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">{p.uptime}% uptime</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blue-600"
                    style={{ width: `${(p.ips / 8_420_000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
