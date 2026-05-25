"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthState = {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
};

/**
 * Sign up a new user.
 * Returns AuthState so the form can show inline errors.
 * On success with an immediate session, redirects to /dashboard.
 */
export async function signUpAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // ── Server-side validation ───────────────────────────────────
  if (!username || username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  // ── Get the request origin for the email confirmation link ──
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  // ── Call Supabase ────────────────────────────────────────────
  let session: { user: unknown } | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${origin}/api/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    session = data.session;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong. Please try again.",
    };
  }

  // ── If a session was issued, head to the dashboard ───────────
  if (session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  // ── Otherwise, the user must confirm their email ─────────────
  return { ok: true, needsConfirmation: true };
}

/**
 * Sign an existing user in.
 * Returns AuthState so the form can show inline errors.
 * On success, redirects to /dashboard (or the requested redirect_to).
 */
export async function signInAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard");

  if (!email || !password) {
    return { ok: false, error: "Please enter your email and password." };
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: error.message };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}
