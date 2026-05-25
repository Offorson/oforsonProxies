import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { DASHBOARD_NAV, ADMIN_LINK } from "@/constants/nav";

export const dynamic = "force-dynamic";

// Hard cap on auth check. If auth itself takes more than 3s, we still render
// the dashboard chrome (middleware has already gated unauthed traffic).
const AUTH_TIMEOUT_MS = 3000;

async function quickGetUser() {
  try {
    const supabase = await createServerSupabase();
    const winner = await Promise.race<
      | { kind: "ok"; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null }
      | { kind: "timeout" }
    >([
      supabase.auth.getUser().then((r) => ({ kind: "ok", user: r.data.user })),
      new Promise((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), AUTH_TIMEOUT_MS)
      ),
    ]);
    return winner;
  } catch {
    return { kind: "timeout" as const };
  }
}

// The admin flag lives in the profiles table (RLS-gated). Fails safe to
// `false` on timeout/error so the dashboard always renders.
async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    return await Promise.race<boolean>([
      supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => !!data?.is_admin),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), AUTH_TIMEOUT_MS)
      ),
    ]);
  } catch {
    return false;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await quickGetUser();

  if (res.kind === "ok" && !res.user) {
    redirect("/login");
  }

  const user = res.kind === "ok" ? res.user : null;
  const meta = (user?.user_metadata ?? {}) as { username?: string; avatar_url?: string };

  const displayUser = {
    name: meta.username ?? user?.email?.split("@")[0] ?? "Account",
    email: user?.email ?? "",
    avatar: meta.avatar_url,
  };

  // Show the Admin entry in the sidebar only for admin accounts.
  const isAdmin = user ? await checkIsAdmin(user.id) : false;
  const navItems = isAdmin ? [...DASHBOARD_NAV, ADMIN_LINK] : DASHBOARD_NAV;

  // Sidebar (w-64) is a flex sibling that already claims its 256px of
  // layout. The previous lg:pl-64 here added another 256px of padding
  // on top of that, which is what pushed all dashboard content far to
  // the right. Removed. min-w-0 lets the flex child shrink so wide
  // tables/iframes do not blow the layout out.
  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar items={navItems} />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar user={displayUser} navItems={navItems} />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
