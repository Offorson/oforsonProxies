import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { ADMIN_NAV } from "@/constants/nav";
import { ShieldAlert } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayUser: { name: string; email: string; avatar?: string } = {
    name: "Admin",
    email: "",
  };
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const meta = (data.user.user_metadata ?? {}) as {
        username?: string;
        avatar_url?: string;
      };
      displayUser = {
        name: meta.username ?? data.user.email?.split("@")[0] ?? "Admin",
        email: data.user.email ?? "",
        avatar: meta.avatar_url,
      };
    }
  } catch {
    /* keep the fallback */
  }

  return (
    <div className="flex min-h-screen bg-ink-50/40">
      <Sidebar
        items={ADMIN_NAV}
        footer={
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 p-3 text-xs">
            <ShieldAlert className="h-4 w-4 text-brand-600" />
            <span className="text-ink-700 font-medium">Admin mode</span>
          </div>
        }
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={displayUser} navItems={ADMIN_NAV} />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
