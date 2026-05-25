import { ArrowRight, Download, Receipt } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardLive } from "@/components/dashboard/dashboard-live";
import { ProxyIntegration } from "@/components/dashboard/proxy-integration";

// The page itself is a pure UI shell — synchronous, zero awaits, zero DB
// calls. All live data is fetched from /api/dashboard by the client
// component below, with skeletons in the meantime. This guarantees the
// page renders instantly no matter what Supabase is doing.
export const dynamic = "force-dynamic";

export default function DashboardOverview() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="A live snapshot of your proxy infrastructure."
        actions={
          <>
            <Button variant="outline" size="md">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Link
              href="/dashboard/billing#invoices"
              className="btn-outline h-10"
            >
              <Receipt className="h-4 w-4" /> Receipts
            </Link>
            <Link href="/dashboard/billing" className="btn-primary h-10">
              Buy proxies <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <DashboardLive />

      <ProxyIntegration />
    </>
  );
}
