import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { z } from "zod";

/**
 * QA harness: sign in as a seeded test user from the server side.
 *
 * The sandbox harness now signs in client-side (the browser Supabase
 * client writes session cookies straight to document.cookie). This
 * endpoint is the optional server-side equivalent useful for scripts
 * or curl.
 *
 * Cookies that Supabase wants to set are collected into a local array
 * and stamped onto the JSON response ourselves: a plain
 * NextResponse.json from a route handler doesn't reliably flush cookies
 * written via next/headers' cookies().set().
 *
 * QA-only. Disabled in production unless QA_ROUTES_ENABLED is set.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function qaEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.QA_ROUTES_ENABLED === "true"
  );
}

interface PendingCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

function stamp(res: NextResponse, cookies: PendingCookie[]) {
  for (const c of cookies) res.cookies.set(c.name, c.value, c.options);
  return res;
}

export async function POST(request: NextRequest) {
  if (!qaEnabled()) {
    return NextResponse.json({ error: "QA routes disabled" }, { status: 404 });
  }

  let payload: z.infer<typeof Body>;
  try {
    payload = Body.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 }
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing on the server." },
      { status: 500 }
    );
  }

  const pending: PendingCookie[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: PendingCookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            const existing = pending.findIndex((p) => p.name === name);
            if (existing >= 0) pending.splice(existing, 1);
            pending.push({ name, value, options });
          });
        },
      },
    }
  );

  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    return stamp(
      NextResponse.json(
        {
          ok: false,
          error: error.message,
          hint: error.message?.toLowerCase().includes("invalid")
            ? "Run database/migrations/006_qa_seed.sql the seeded password is TestPass!2026."
            : undefined,
        },
        { status: 400 }
      ),
      pending
    );
  }

  const { data: confirm } = await supabase.auth.getUser();

  return stamp(
    NextResponse.json({
      ok: true,
      signed_in_as: confirm.user?.email ?? data.user?.email ?? null,
      user_id: confirm.user?.id ?? data.user?.id ?? null,
    }),
    pending
  );
}
