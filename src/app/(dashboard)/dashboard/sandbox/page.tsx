import { redirect } from "next/navigation";
// import { getSession } from "@/lib/auth/session";
// import { PageHeader } from "@/components/dashboard/page-header";
// import { SandboxHarness } from "./harness";

export const metadata = { title: "QA Sandbox" };
export const dynamic = "force-dynamic";

/**
 * Internal QA harness — TEMPORARILY DISABLED while the site is under review.
 *
 * The Sandbox is hidden from the dashboard navigation (see src/constants/nav.ts)
 * and this route simply redirects away, so reviewers never reach the harness.
 *
 * To resume development:
 *   1. Un-comment the three imports above and the original body below.
 *   2. Delete the `redirect("/dashboard")` line.
 *   3. Re-add the Sandbox entry in src/constants/nav.ts.
 * The harness component itself (./harness) is left untouched.
 */
export default function SandboxPage() {
  redirect("/dashboard");

  /*
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/sandbox");

  const allowed =
    session.profile?.is_admin ||
    process.env.NODE_ENV !== "production" ||
    process.env.QA_ROUTES_ENABLED === "true";

  if (!allowed) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="QA Sandbox"
        description="Trigger backend calls, preview responsive UI, and rehearse billing flows without leaving the dashboard."
      />
      <SandboxHarness
        currentUserId={session.user.id}
        currentUserEmail={session.user.email ?? ""}
        isAdmin={!!session.profile?.is_admin}
      />
    </>
  );
  */
}
