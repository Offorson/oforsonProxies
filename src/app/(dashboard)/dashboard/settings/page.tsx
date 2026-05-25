import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { ProfileForm, PasswordForm } from "./settings-forms";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

async function getAccount(): Promise<{ displayName: string; email: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return { displayName: "", email: "" };
    const meta = (user.user_metadata ?? {}) as { username?: string };
    return {
      displayName: meta.username ?? user.email?.split("@")[0] ?? "",
      email: user.email ?? "",
    };
  } catch {
    return { displayName: "", email: "" };
  }
}

export default async function SettingsPage() {
  const { displayName, email } = await getAccount();

  return (
    <>
      <PageHeader title="Settings" description="Manage your account, security and preferences." />

      <div className="space-y-6 max-w-3xl">
        {/* Profile form — client component with real save action */}
        <ProfileForm displayName={displayName} email={email} />

        {/* Password form — client component with real update action */}
        <PasswordForm />

        <Card>
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>Add an extra layer of security to your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-900">Authenticator app</p>
              <p className="text-xs text-ink-500">Not enrolled</p>
            </div>
            <Button variant="outline">Enable 2FA</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose what you want to be alerted about.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Bandwidth thresholds (80%, 95%, 100%)", on: true },
              { label: "API errors", on: true },
              { label: "Monthly usage report", on: false },
              { label: "Product updates", on: false }
            ].map((p) => (
              <label key={p.label} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                <span className="text-sm text-ink-800">{p.label}</span>
                <input type="checkbox" defaultChecked={p.on} className="h-4 w-4 accent-brand-500" />
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-rose-700">Danger zone</CardTitle>
            <CardDescription>Permanent account actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="danger">Delete account</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
