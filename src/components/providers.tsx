"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Background listener that refreshes the router on auth state changes.
 *
 * Everything here is wrapped in try/catch and isolated inside a useEffect
 * so that, if the Supabase client ever fails to construct or the SDK
 * throws, it CANNOT break hydration of the rest of the app. (A previous
 * version of this file would crash the whole tree, leaving forms in a
 * non-interactive state.)
 */
function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    let unsub: (() => void) | undefined;

    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          router.refresh();
        }
        if (event === "SIGNED_OUT") {
          router.push("/login");
        }
      });
      unsub = () => data.subscription.unsubscribe();
    } catch (err) {
      // Never let auth-listener errors propagate to hydration.
      // eslint-disable-next-line no-console
      console.warn("[AuthListener] disabled:", err);
    }

    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, [router]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthListener />
      {children}
    </>
  );
}
