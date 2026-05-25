"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

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

    // Update auth metadata so future sessions pick up the new name
    const { error: authErr } = await supabase.auth.updateUser({
      data: { username: displayName },
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
