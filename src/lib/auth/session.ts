import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/types";

/**
 * Returns the current authenticated user + their profile, or null.
 */
export async function getSession() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return { user, profile };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || !session.profile?.is_admin) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
