import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sessions" };

const SESSIONS = [
  { id: "ses_3a91", type: "Rotating", country: "US", ip: "198.51.100.42", started: "2m ago", traffic: "812 MB", active: true },
  { id: "ses_2c12", type: "Static", country: "DE", ip: "203.0.113.18", started: "12m ago", traffic: "1.4 GB", active: true },
  { id: "ses_8b30", type: "Datacenter", country: "UK", ip: "192.0.2.7", started: "45m ago", traffic: "640 MB", active: true },
  { id: "ses_1f55", type: "Rotating", country: "JP", ip: "198.51.100.91", started: "2h ago", traffic: "2.1 GB", active: false },
  { id: "ses_6d20", type: "Static", country: "BR", ip: "203.0.113.50", started: "5h ago", traffic: "980 MB", active: false }
];

export default function SessionsPage() {
  return (
    <>
      <PageHeader title="Active sessions" description="Monitor live proxy sessions in real time." />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-6 py-3">Session</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Country</th>
                <th className="px-6 py-3">IP</th>
                <th className="px-6 py-3">Started</th>
                <th className="px-6 py-3">Traffic</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {SESSIONS.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50/40 transition">
                  <td className="px-6 py-4 font-mono text-xs text-ink-700">{s.id}</td>
                  <td className="px-6 py-4 text-ink-900">{s.type}</td>
                  <td className="px-6 py-4 text-ink-700">{s.country}</td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-700">{s.ip}</td>
                  <td className="px-6 py-4 text-ink-500">{s.started}</td>
                  <td className="px-6 py-4 text-ink-900 font-medium">{s.traffic}</td>
                  <td className="px-6 py-4">
                    {s.active ? (
                      <Badge variant="success">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulseDot" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Ended</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.active && (
                      <Button variant="ghost" size="sm">
                        Disconnect
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
