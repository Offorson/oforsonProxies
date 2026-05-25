"use client";

import { useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useCopy } from "@/hooks/useCopy";

const SAMPLE_KEYS = [
  { id: "1", name: "Production", prefix: "ofx_live_4f2b…", lastUsed: "2m ago", created: "Mar 12, 2026" },
  { id: "2", name: "Staging", prefix: "ofx_test_91ac…", lastUsed: "5h ago", created: "Jan 04, 2026" }
];

export default function ApiPage() {
  const [open, setOpen] = useState(false);
  const { copy, copied } = useCopy();

  return (
    <>
      <PageHeader
        title="API keys"
        description="Programmatically generate, rotate, and revoke proxy credentials."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New API key
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
          <CardDescription>Keep these secret. Treat them like passwords.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-ink-100">
            {SAMPLE_KEYS.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{k.name}</p>
                    <p className="text-xs text-ink-500">Created {k.created} · Last used {k.lastUsed}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <code className="hidden sm:inline-flex text-xs font-mono text-ink-700 bg-ink-50 px-2 py-1 rounded-md">
                    {k.prefix}
                  </code>
                  <button
                    onClick={() => copy(k.prefix)}
                    className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <Badge variant="success">Active</Badge>
                  <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create API key"
        description="Give your key a memorable name."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Create key</Button>
          </div>
        }
      >
        <Input label="Key name" placeholder="e.g. Production scraper" />
      </Modal>
    </>
  );
}
