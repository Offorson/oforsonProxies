"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Confirmation links are valid for 1 hour. */
const DELETE_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Update the signed-in user's display name.
 * Writes to both auth.user_metadata and the profiles table.
 */
export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName || displayName.length < 1) {
    return { ok: false, error: "Display name cannot be empty." };
  }

  try {
    const supabase = await createServerSupabase();

    // Update auth metadata so future sessions pick up the new name.
    // `display_name` is what the Supabase Auth dashboard reads.
    const { error: authErr } = await supabase.auth.updateUser({
      data: { username: displayName, display_name: displayName },
    });
    if (authErr) return { ok: false, error: authErr.message };

    // Also sync the profiles table
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({ username: displayName })
        .eq("id", userData.user.id);
    }

    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

/**
 * Change the signed-in user's password.
 * Requires the current password for verification, then sets the new one.
 */
export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return { ok: false, error: "Please enter your current password." };
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }

  try {
    const supabase = await createServerSupabase();

    // Verify the current password by re-authenticating
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) return { ok: false, error: "Not authenticated." };

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });
    if (signInErr) return { ok: false, error: "Current password is incorrect." };

    // Now set the new password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) return { ok: false, error: updateErr.message };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

/**
 * Request account deletion. Generates a single-use token, stores it (with an
 * expiry) on the user's auth metadata, and emails the user a magic link that
 * lands on /api/auth/delete-account/confirm. The actual deletion only happens
 * once the user clicks that link.
 */
export async function requestAccountDeletionAction(): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user?.email) {
      return { ok: false, error: "You must be signed in to delete your account." };
    }
    const email = userData.user.email;

    // Build the absolute origin so the email link resolves on whatever host
    // the user is browsing from (works in dev and prod).
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const origin = `${proto}://${host}`;

    // Stash a short-lived confirmation token in user_metadata. The confirm
    // route checks both that the user is signed in (via the magic link) AND
    // that this token is still valid — so a stray magic link can't be used
    // to delete an account that the user didn't actively try to delete.
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + DELETE_TOKEN_TTL_MS;

    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        pending_deletion: { token, expires_at: expiresAt },
      },
    });
    if (metaErr) return { ok: false, error: metaErr.message };

    // Send a magic link. Clicking it signs the user in and then forwards to
    // our confirm route, which reads the token from metadata and finishes
    // the deletion. We pass the token in the redirect URL so the confirm
    // route can compare it against the one stored on the user.
    const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(
      `/api/auth/delete-account/confirm?token=${token}`
    )}`;

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    });
    if (otpErr) return { ok: false, error: otpErr.message };

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
