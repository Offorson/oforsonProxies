"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export function useUser() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single<Profile>();
      if (mounted) {
        setProfile(data);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { profile, loading };
}
