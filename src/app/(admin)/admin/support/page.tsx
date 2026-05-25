import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";

export const metadata = { title: "Admin · Support" };

const TICKETS = [
  { id: "TCK-441", user: "lia@beck.io", subject: "Bandwidth not resetting correctly", priority: "high", status: "open", time: "12m ago" },
  { id: "TCK-440", user: "felix@quanta.com", subject: "Need DE city-level targeting", priority: "normal", status: "pending", time: "1h ago" },
  { id: "TCK-439", user: "ada@cloudgrid.dev", subject: "Stripe invoice mismatch for May", priority: "urgent", status: "open", time: "2h ago" },
  { id: "TCK-438", user: "mateo@reply.io", subject: "API 429s during peak hours", priority: "normal", status: "resolved", time: "Yesterday" },
  { id: "TCK-437", user: "yuki@sage.ai", subject: "Sticky sessions disconnecting", priority: "low", status: "closed", time: "2d ago" }
];

const variantFor = (s: string) =>
  s === "open" ? "warning" : s === "pending" ? "brand" : s === "resolved" ? "success" : "neutral";

const priorityFor = (p: string) =>
  p === "urgent" ? "danger" : p === "high" ? "warning" : p === "normal" ? "brand" : "neutral";

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Support queue" description="Triage tickets and resolve user complaints quickly." />

      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="Open tickets" value="14" delta={-12.0} hint="vs last week" />
        <Stat label="Avg first response" value="42 min" delta={-8.4} />
        <Stat label="Resolved (7d)" value="38" delta={11.4} />
        <Stat label="CSAT" value="4.8 / 5" delta={2.1} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent tickets</CardTitle>
          <CardDescription>Sorted by latest activity</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60 text-left text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {TICKETS.map((t) => (
                  <tr key={t.id} className="hover:bg-ink-50/40 cursor-pointer">
                    <td className="px-6 py-4 font-mono text-xs text-ink-700">{t.id}</td>
                    <td className="px-6 py-4 text-ink-800">{t.user}</td>
                    <td className="px-6 py-4 text-ink-900 font-medium">{t.subject}</td>
                    <td className="px-6 py-4">
                      <Badge variant={priorityFor(t.priority) as never}>{t.priority}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={variantFor(t.status) as never}>{t.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-ink-500">{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
