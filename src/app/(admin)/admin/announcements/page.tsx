"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

const ANNOUNCEMENTS = [
  { id: "ann_1", title: "Scheduled maintenance Jun 1, 02:00 UTC", level: "info" as const, body: "Brief 30-minute downtime on the EU edge.", published: "2 days ago" },
  { id: "ann_2", title: "New rotating residential pool in LATAM", level: "info" as const, body: "Adds 4M+ Brazil and Mexico IPs.", published: "1 week ago" },
  { id: "ann_3", title: "Incident elevated latency on US-East", level: "incident" as const, body: "Resolved after 14 minutes. Postmortem published.", published: "2 weeks ago" }
];

const variantFor = (l: string) => (l === "incident" ? "danger" : l === "warning" ? "warning" : "brand");

export default function AnnouncementsPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Broadcast platform messages to all users."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ANNOUNCEMENTS.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 text-brand-600">
                  <Megaphone className="h-4 w-4" />
                </div>
                <Badge variant={variantFor(a.level) as never}>{a.level}</Badge>
              </div>
              <CardTitle className="mt-3 text-base">{a.title}</CardTitle>
              <CardDescription>{a.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-ink-500">Published {a.published}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New announcement"
        description="Broadcast a message to all users."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Publish</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Title" placeholder="Scheduled maintenance…" />
          <div>
            <label className="text-sm font-medium text-ink-800">Body</label>
            <textarea className="input mt-1.5 min-h-32" placeholder="What should users know?" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-800">Severity</label>
            <select className="input mt-1.5">
              <option>Info</option>
              <option>Warning</option>
              <option>Incident</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}
