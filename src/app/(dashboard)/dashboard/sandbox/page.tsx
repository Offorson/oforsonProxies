import { redirect } from "next/navigation";

export const metadata = { title: "QA Sandbox" };
export const dynamic = "force-dynamic";

/**
 * Internal QA harness TEMPORARILY DISABLED while the site is under review.
 * To resume development:
 *   1. Un-comment the imports and original body below.
 *   2. Delete the `redirect("/dashboard")` line.
 *   3. Re-add the Sandbox entry in src/constants/nav.ts.
 */
export default function SandboxPage() {
  redirect("/dashboard");
}
