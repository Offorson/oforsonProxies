"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  MoreVertical,
  ShieldOff,
  Check,
  Plus,
  Copy,
  Ban,
  UserCheck,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Status = "active" | "suspended" | "pending_verification";

interface Subscription {
  plan: string | null;
  bandwidth_used_gb: number | null;
  bandwidth_gb: number | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  bw: string;
  status: Status;
  joined: string;
}

const STATUSES = ["all", "active", "suspended", "pending_verification"] as const;
const MENU_WIDTH = 208;

function formatBandwidth(usedGb: number | null | undefined, totalGb: number | null | undefined): string {
  if (usedGb == null) return "— GB";
  const used = Math.round(usedGb);
  return totalGb ? `${used} / ${totalGb} GB` : `${used} GB`;
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function mapApiUser(u: {
  id: string;
  email: string;
  username: string | null;
  account_status: string;
  created_at: string;
  subscriptions?: Subscription[] | Subscription | null;
}): User {
  const sub = Array.isArray(u.subscriptions) ? u.subscriptions[0] : u.subscriptions;
  return {
    id: u.id,
    name: u.username ?? u.email.split("@")[0],
    email: u.email,
    plan: sub?.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : "Free",
    bw: formatBandwidth(sub?.bandwidth_used_gb, sub?.bandwidth_gb),
    status: (u.account_status ?? "active") as Status,
    joined: formatJoined(u.created_at),
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; above: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fetch real users from Supabase via API
  const fetchUsers = useCallback(async (search: string, filterStatus: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { users: unknown[]; count: number };
      setUsers((json.users ?? []).map((u: any) => mapApiUser(u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search so we don't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(q, status), 300);
    return () => clearTimeout(t);
  }, [q, status, fetchUsers]);

  // Close menu on outside click / Escape / scroll
  useEffect(() => {
    if (!menu) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    const onScroll = () => setMenu(null);
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointer);
      document.addEventListener("keydown", onKey);
      window.addEventListener("scroll", onScroll, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    if (menu?.id === id) { setMenu(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    // Flip the menu above the button if it would overflow the viewport bottom
    const MENU_HEIGHT_EST = 90;
    const above = r.bottom + 6 + MENU_HEIGHT_EST > window.innerHeight;
    setMenu({ id, x: r.right, y: above ? r.top : r.bottom, above });
  };

  const patchUser = async (userId: string, nextStatus: Status, label: string) => {
    setMenu(null);
    // Optimistic update
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          account_status: nextStatus,
          description: `Admin set status to ${nextStatus}`,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      flash(label);
    } catch {
      // Revert on failure
      fetchUsers(q, status);
      flash("Update failed — changes reverted");
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      flash(`Copied ${email}`);
    } catch {
      flash("Could not access clipboard");
    }
    setMenu(null);
  };

  const menuUser = menu ? users.find((u) => u.id === menu.id) ?? null : null;

  return (
    <>
      <PageHeader
        title="Users"
        description="Search, filter, and manage user accounts."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Invite user
          </Button>
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email..."
            className="input pl-10"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                status === s ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Bandwidth</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-ink-400">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading users…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-ink-400">
                    No users found.
                  </td>
                </tr>
              )}
              {!loading && users.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50/40">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-blue-600 text-xs font-semibold text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink-900">{u.name}</p>
                        <p className="text-xs text-ink-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="brand">{u.plan}</Badge>
                  </td>
                  <td className="px-6 py-4 text-ink-900 font-medium">{u.bw}</td>
                  <td className="px-6 py-4">
                    {u.status === "active" && (
                      <Badge variant="success">
                        <Check className="h-3 w-3" /> Active
                      </Badge>
                    )}
                    {u.status === "suspended" && (
                      <Badge variant="danger">
                        <ShieldOff className="h-3 w-3" /> Suspended
                      </Badge>
                    )}
                    {u.status === "pending_verification" && (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink-500">{u.joined}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => openMenu(e, u.id)}
                      aria-haspopup="menu"
                      aria-expanded={menu?.id === u.id}
                      aria-label={`Actions for ${u.name}`}
                      className={`rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 ${
                        menu?.id === u.id ? "bg-ink-100 text-ink-900" : ""
                      }`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Context menu — fixed positioned, flips above button if near viewport bottom */}
      {menu && menuUser && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${menuUser.name}`}
          className="fixed z-50 w-52 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
          style={{
            left: Math.max(8, menu.x - MENU_WIDTH),
            ...(menu.above
              ? { bottom: window.innerHeight - menu.y + 6 }
              : { top: menu.y + 6 }),
          }}
        >
          <button
            role="menuitem"
            onClick={() => copyEmail(menuUser.email)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            <Copy className="h-4 w-4 text-ink-400" /> Copy email
          </button>

          {menuUser.status === "active" ? (
            <button
              role="menuitem"
              onClick={() => patchUser(menuUser.id, "suspended", `${menuUser.name} suspended`)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <Ban className="h-4 w-4" /> Suspend user
            </button>
          ) : (
            <button
              role="menuitem"
              onClick={() => patchUser(menuUser.id, "active", `${menuUser.name} is now active`)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50"
            >
              <UserCheck className="h-4 w-4" />
              {menuUser.status === "suspended" ? "Reactivate user" : "Mark as active"}
            </button>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
