import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Finalizes account deletion. The user reaches this route by clicking the
 * magic link we emailed them from the settings page. By the time we get here:
 *
 *   1. They are signed in (the magic link exchange happened in /api/auth/callback).
 *   2. Their auth metadata carries a `pending_deletion: { token, expires_at }`
 *      blob that we wrote when they clicked "Delete account".
 *
 * We verify the token in the URL matches the one on the user and that it
 * hasn't expired, then use the service-role client to actually delete the
 * account. RLS-protected user data tied to the auth user via FK cascade is
 * cleaned up automatically.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  const supabase = await createServerSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.redirect(
      `${origin}/login?error=delete_account_session_expired`
    );
  }

  const user = userData.user;
  const meta = (user.user_metadata ?? {}) as {
    pending_deletion?: { token?: string; expires_at?: number };
  };
  const pending = meta.pending_deletion;

  if (!token || !pending?.token || pending.token !== token) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?delete_account=invalid_token`
    );
  }
  if (typeof pending.expires_at !== "number" || pending.expires_at < Date.now()) {
    // Token expired — clear the stale marker and ask the user to try again.
    await supabase.auth.updateUser({ data: { pending_deletion: null } });
    return NextResponse.redirect(
      `${origin}/dashboard/settings?delete_account=expired`
    );
  }

  // Token is valid: delete the user with the service-role client.
  try {
    const admin = createAdminClient();
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return NextResponse.redirect(
        `${origin}/dashboard/settings?delete_account=failed`
      );
    }
  } catch {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?delete_account=failed`
    );
  }

  // Sign the now-deleted user's session out and send them home.
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/?account_deleted=1`);
}
