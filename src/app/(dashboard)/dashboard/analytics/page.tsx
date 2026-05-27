import { Globe2, Activity, Zap, Layers } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Stat } from "@/components/ui/stat";
import { fetchUserAnalytics } from "@/lib/data/analytics";

export const metadata = { title: "Analytics" };

// Reads the signed-in user's live data on every request.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await fetchUserAnalytics();

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Live visibility into your usage and proxy mix."
      />

      <div className="grid gap-5 md:grid-cols-4">
        <Stat
          label="Bandwidth used (30d)"
          value={`${data.totalGb30d.toFixed(2)} GB`}
          hint="last 30 days"
          icon={<Zap className="h-5 w-5" />}
        />
        <Stat
          label="Bandwidth today"
          value={`${data.gbToday.toFixed(2)} GB`}
          hint="since midnight"
          icon={<Activity className="h-5 w-5" />}
        />
        <Stat
          label="Active proxies"
          value={data.activeProxies.toLocaleString()}
          hint="right now"
          icon={<Globe2 className="h-5 w-5" />}
        />
        <Stat
          label="Total proxies"
          value={data.totalProxies.toLocaleString()}
          hint="all time"
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily traffic</CardTitle>
            <CardDescription>GB transferred per day last 30 days</CardDescription>
          </CardHeader>
                  <CardContent>
            <AreaChart data={data.traffic30d} dataKey="gb" xKey="name" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By proxy type</CardTitle>
            <CardDescription>GB used per product</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={data.bandwidthByType} dataKey="gb" xKey="name" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
