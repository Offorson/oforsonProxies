"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Info,
  LogIn,
  LogOut,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Wifi,
  XCircle,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ViewportToggle,
  VIEWPORT_WIDTH,
  type Viewport,
} from "@/components/ui";
import { cn } from "@/utils/cn";

// Test users seeded by 006_qa_seed.sql. Each row carries the
// subscription details so picking a target user can auto-fill the
// proxy_type + plan dropdowns.
type ProxyType = "static_residential" | "rotating_residential" | "datacenter";
type Plan = "starter" | "pro" | "business" | "enterprise";

interface QaUser {
  id: string;
  email: string;
  label: string;
  proxyType: ProxyType;
  plan: Plan;
  isAdmin?: boolean;
  note?: string;
}

const QA_USERS: QaUser[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "admin@qa.oforson.test",
    label: "Admin",
    proxyType: "rotating_residential",
    plan: "enterprise",
    isAdmin: true,
    note: "No subscription. Pick any plan to test admin views.",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "pro.res@qa.oforson.test",
    label: "Pro - Rotating Residential",
    proxyType: "rotating_residential",
    plan: "pro",
    note: "~57% bandwidth used.",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "biz.static@qa.oforson.test",
    label: "Business - Static Residential",
    proxyType: "static_residential",
    plan: "business",
    note: "~30% bandwidth used.",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    email: "ent.dc@qa.oforson.test",
    label: "Enterprise - Datacenter",
    proxyType: "datacenter",
    plan: "enterprise",
    note: "~20% bandwidth used.",
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    email: "trial.dc@qa.oforson.test",
    label: "Trial - Datacenter",
    proxyType: "datacenter",
    plan: "starter",
    note: "Trialing, ~5% used.",
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    email: "capped@qa.oforson.test",
    label: "Capped (over limit)",
    proxyType: "rotating_residential",
    plan: "pro",
    note: "108% used. Exercises the soft-lock + upgrade flow.",
  },
];

const QA_PASSWORD = "TestPass!2026";
const GIGABYTE = 1_073_741_824;
const PRESET_GB = [1, 10, 100, 1000];

interface LogEntry {
  id: number;
  ts: string;
  label: string;
  ok: boolean;
  durationMs: number;
  payload: unknown;
}

interface Props {
  currentUserId: string;
  currentUserEmail: string;
  isAdmin: boolean;
}

export function SandboxHarness({ currentUserEmail, isAdmin }: Props) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [targetUser, setTargetUser] = useState(QA_USERS[1].id);
  const targetUserObj = QA_USERS.find((u) => u.id === targetUser) ?? QA_USERS[1];

  const [proxyType, setProxyType] = useState<ProxyType>(targetUserObj.proxyType);
  const [plan, setPlan] = useState<Plan>(targetUserObj.plan);
  const [overridePlan, setOverridePlan] = useState(false);

  useEffect(() => {
    if (overridePlan) return;
    setProxyType(targetUserObj.proxyType);
    setPlan(targetUserObj.plan);
  }, [targetUserObj.id, targetUserObj.proxyType, targetUserObj.plan, overridePlan]);

  const [usageGb, setUsageGb] = useState<number>(5);
  const bytes = Math.max(0, Math.round(usageGb * GIGABYTE));

  const [log, setLog] = useState<LogEntry[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Live "server sees" indicator. Polls /api/dashboard every 4s and
  // also refreshes immediately after every action via the bumpProbe
  // counter. Source of truth for "did the sign-in swap actually
  // commit on the server".
  const [serverSees, setServerSees] = useState<string | null>(null);
  const [probeTick, setProbeTick] = useState(0);
  const bumpProbe = useCallback(() => setProbeTick((t) => t + 1), []);
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const res = await fetch("/api/dashboard", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        if (!cancelled) setServerSees(json?._auth?.email ?? "(no session)");
      } catch {
        if (!cancelled) setServerSees("(probe failed)");
      }
    };
    probe();
    const id = setInterval(probe, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [probeTick]);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const reloadIframe = useCallback(() => {
    const f = iframeRef.current;
    if (!f) return;
    // Two-step swap: about:blank tears down the current document so the
    // browser cannot reuse cached resources or stale auth from the
    // previous load. Then we point it at /dashboard with a fresh cache
    // buster. This is what reliably picks up the new auth cookies after
    // "Sign in as target".
    f.src = "about:blank";
    requestAnimationFrame(() => {
      const url = new URL("/dashboard", window.location.origin);
      url.searchParams.set("_ts", String(Date.now()));
      if (f) f.src = url.toString();
    });
  }, []);

  const openTargetInNewTab = useCallback(() => {
    window.open("/dashboard", "_blank", "noopener");
  }, []);

  const record = useCallback(
    (label: string, ok: boolean, durationMs: number, payload: unknown) => {
      setLog((prev) =>
        [
          {
            id: Date.now() + Math.random(),
            ts: new Date().toLocaleTimeString(),
            label,
            ok,
            durationMs,
            payload,
          },
          ...prev,
        ].slice(0, 25)
      );
    },
    []
  );

  const run = useCallback(
    async (
      id: string,
      label: string,
      fn: () => Promise<{
        ok: boolean;
        payload: unknown;
        successBanner?: string;
        errorBanner?: string;
        afterSuccess?: () => void | Promise<void>;
      }>
    ) => {
      setPendingId(id);
      setBanner(null);
      const start = performance.now();
      try {
        const { ok, payload, successBanner, errorBanner, afterSuccess } = await fn();
        const dur = Math.round(performance.now() - start);
        record(label, ok, dur, payload);
        if (ok) {
          if (successBanner) setBanner({ kind: "ok", text: successBanner });
          if (afterSuccess) await afterSuccess();
        } else {
          const errMsg =
            (payload &&
              typeof payload === "object" &&
              ((payload as { message?: string }).message ??
                (payload as { error?: string }).error)) ||
            "Request failed";
          setBanner({
            kind: "err",
            text: errorBanner ? errorBanner + ": " + String(errMsg) : String(errMsg),
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        record(label, false, Math.round(performance.now() - start), { error: msg });
        setBanner({ kind: "err", text: msg });
      } finally {
        setPendingId(null);
        bumpProbe();
      }
    },
    [record, bumpProbe]
  );

  // Signs in as the selected QA user with the browser Supabase client.
  // signInWithPassword writes the new session straight to document.cookie,
  // so the next request (the iframe reload below) goes out as the target
  // user.
  //
  // We deliberately do NOT sign out first. A sign-out followed by a
  // failed sign-in (Supabase unreachable, project paused, DevTools set
  // to "Offline", or an un-seeded QA user) would leave the admin with
  // no session and strand them on /login. signInWithPassword replaces
  // the current session on success and leaves it untouched on failure,
  // so the admin stays logged in if the QA sign-in fails. The call is
  // wrapped in an 8s race so an unreachable backend surfaces as a clear
  // error instead of an indefinitely spinning button.
  const testSignIn = () =>
    run("auth-signin", "Auth - sign in as " + targetUserObj.email, async () => {
      let result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      try {
        result = await Promise.race([
          supabase.auth.signInWithPassword({
            email: targetUserObj.email,
            password: QA_PASSWORD,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("sign-in timed out after 8s")),
              8000
            )
          ),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          payload: { error: msg },
          errorBanner:
            "Could not reach Supabase to sign in as " +
            targetUserObj.email +
            ". Check that the Supabase project is awake and that " +
            "DevTools network throttling is not set to Offline",
        };
      }

      const { data, error } = result;

      if (error) {
        return {
          ok: false,
          payload: {
            error: error.message,
            status: error.status,
            hint: error.message?.toLowerCase().includes("invalid")
              ? "Run database/migrations/006_qa_seed.sql in your Supabase SQL editor the seeded password is TestPass!2026."
              : undefined,
          },
          errorBanner: "Sign-in failed for " + targetUserObj.email,
        };
      }

      return {
        ok: true,
        payload: { user: data.user?.email, id: data.user?.id },
        successBanner:
          "Signed in as " +
          (data.user?.email ?? targetUserObj.email) +
          ". Reloading preview - watch the green dot at the top of the page.",
        afterSuccess: async () => {
          // Let the cookie write settle, then reload the iframe + RSC tree.
          await new Promise((r) => setTimeout(r, 100));
          reloadIframe();
          router.refresh();
          bumpProbe();
        },
      };
    });

  const testSignOut = () =>
    run("auth-signout", "Auth - sign out", async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/auth/signout", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        redirect: "manual",
      });
      const ok =
        res.status === 0 ||
        res.status === 200 ||
        res.status === 302 ||
        res.type === "opaqueredirect";
      return {
        ok,
        payload: { signed_out: ok, server_status: res.status },
        successBanner: "Signed out. Preview will redirect to /login.",
        afterSuccess: () => {
          reloadIframe();
          router.refresh();
        },
      };
    });

  const testWhoAmI = () =>
    run("auth-whoami", "Auth - getUser", async () => {
      const { data, error } = await supabase.auth.getUser();
      return {
        ok: !error,
        payload: error ?? { user: data.user?.email ?? null },
        successBanner: data.user
          ? "Currently authenticated as " + data.user.email + "."
          : "No active session.",
      };
    });

  const testDashboard = () =>
    run("dash-fetch", "Dashboard - fetch (logged-in user)", async () => {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      return { ok: res.ok, payload: json };
    });

  const testProxyList = () =>
    run("proxy-list", "Proxies - list active sessions", async () => {
      const res = await fetch("/api/proxies/list", { cache: "no-store" });
      const json = await res.json();
      const sessions = Array.isArray(json.sessions)
        ? json.sessions.filter((s: { proxy_type: ProxyType }) => s.proxy_type === proxyType)
        : json.sessions;
      return { ok: res.ok, payload: { filter: proxyType, count: sessions?.length ?? 0, sessions } };
    });

  const testGenerate = () =>
    run("proxy-generate", "Proxies - generate (" + proxyType + ")", async () => {
      const res = await fetch("/api/proxies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: proxyType, quantity: 1, country: "US" }),
      });
      const json = await res.json();
      return { ok: res.ok, payload: json };
    });

  const testBatchBandwidth = () =>
    run(
      "qa-bandwidth",
      "QA - batch bandwidth report (+" + usageGb.toFixed(2) + " GB)",
      async () => {
        const res = await fetch("/api/qa/bandwidth-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reports: [
              { user_id: targetUser, bytes_used: bytes, proxy_type: proxyType },
              { user_id: targetUser, bytes_used: Math.floor(bytes * 0.4), proxy_type: proxyType },
            ],
          }),
        });
        const json = await res.json();
        return {
          ok: res.ok,
          payload: json,
          successBanner:
            "Reported +" +
            usageGb.toFixed(2) +
            " GB for " +
            targetUserObj.email +
            ". Reloading /dashboard.",
          afterSuccess: () => reloadIframe(),
        };
      }
    );

  const testCheckout = () =>
    run("bill-checkout", "Billing - create checkout (" + plan + ")", async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan, interval: "monthly" }),
      });
      const json = await res.json();
      return { ok: res.ok, payload: json };
    });

  const testWebhookPaid = () =>
    run("wh-paid", "Billing - simulate invoice.paid", () =>
      simulateWebhookWrapped(targetUser, "invoice.paid", plan, proxyType, reloadIframe)
    );

  const testWebhookCheckout = () =>
    run("wh-checkout", "Billing - simulate checkout.session.completed", () =>
      simulateWebhookWrapped(targetUser, "checkout.session.completed", plan, proxyType, reloadIframe)
    );

  const testWebhookFailed = () =>
    run("wh-failed", "Billing - simulate invoice.payment_failed", () =>
      simulateWebhookWrapped(targetUser, "invoice.payment_failed", plan, proxyType, reloadIframe)
    );

  const testWebhookCanceled = () =>
    run("wh-canceled", "Billing - simulate customer.subscription.deleted", () =>
      simulateWebhookWrapped(targetUser, "customer.subscription.deleted", plan, proxyType, reloadIframe)
    );

  // Deep diagnostic hits /api/qa/diagnose with the service role key
  // and reports whether the seeded QA users have profile rows AND
  // matching subscription / proxy_sessions / bandwidth_usage rows. If
  // the dashboard "looks the same" no matter who you sign in as, the
  // most common cause is the seed-data half of 006_qa_seed.sql never
  // landed in this project this button proves or disproves that.
  const testDiagnose = () =>
    run("qa-diagnose", "QA - diagnose seed + auth state", async () => {
      const res = await fetch("/api/qa/diagnose", {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json();
      const lines: string[] = [];
      if (json.verdict) lines.push("Verdict: " + json.verdict);
      if (json.serverSession?.email) {
        lines.push("Server is signed in as: " + json.serverSession.email);
      } else {
        lines.push("Server sees NO signed-in user.");
      }
      if (Array.isArray(json.reasons) && json.reasons.length) {
        lines.push(...json.reasons);
      }
      return {
        ok: res.ok && json.ok !== false,
        payload: json,
        successBanner: lines.join(" - "),
        errorBanner: lines.join(" - ") || "Diagnose failed",
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>
              Page rendered for{" "}
              <strong>{currentUserEmail || "(no session)"}</strong>
              {" - "}
              {isAdmin ? "admin" : "user"} - target test user:{" "}
              <strong>{targetUserObj.email}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                serverSees && serverSees !== "(no session)" && serverSees !== "(probe failed)"
                  ? "bg-emerald-500"
                  : "bg-rose-500"
              )}
            />
            Server right now sees:{" "}
            <strong className="text-amber-900">
              {serverSees ?? "(checking...)"}
            </strong>
            <button
              onClick={bumpProbe}
              className="ml-1 underline opacity-70 hover:opacity-100"
            >
              re-check
            </button>
          </div>
        </div>
        <ViewportToggle value={viewport} onChange={setViewport} />
      </div>

      {banner ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          {banner.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="flex-1">{banner.text}</div>
          <button
            onClick={() => setBanner(null)}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Live preview</CardTitle>
                <CardDescription>
                  Constrained to {VIEWPORT_WIDTH[viewport]}px to mirror the {viewport} breakpoint.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-ink-500">
                  {VIEWPORT_WIDTH[viewport]}px
                </span>
                <Button size="sm" variant="outline" onClick={reloadIframe}>
                  <RefreshCw className="h-3.5 w-3.5" /> Reload
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="mx-auto overflow-hidden rounded-2xl border border-ink-200 bg-ink-50/50 transition-all"
              style={{ maxWidth: VIEWPORT_WIDTH[viewport] }}
            >
              <iframe
                ref={iframeRef}
                title="Dashboard preview"
                src="/dashboard"
                className="h-[720px] w-full bg-white"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Target user</CardTitle>
              <CardDescription>
                Affects auth + webhook + bandwidth simulations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm"
              >
                {QA_USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label} - {u.email}
                  </option>
                ))}
              </select>

              <div className="flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                <div className="flex-1 leading-snug">
                  <div>
                    Plan + proxy type auto-filled:{" "}
                    <strong className="text-ink-800">{prettyPlan(plan)}</strong>
                    {" - "}
                    <strong className="text-ink-800">{prettyProxyType(proxyType)}</strong>
                  </div>
                  {targetUserObj.note ? (
                    <div className="mt-0.5 text-ink-500">{targetUserObj.note}</div>
                  ) : null}
                </div>
              </div>

              <button
                onClick={() => setOverridePlan((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {overridePlan
                  ? "Override on - close"
                  : "Override plan / proxy type for edge-case tests"}
              </button>

              {overridePlan ? (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={proxyType}
                    onChange={(e) => setProxyType(e.target.value as ProxyType)}
                    className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm"
                  >
                    <option value="rotating_residential">Rotating Residential</option>
                    <option value="static_residential">Static Residential</option>
                    <option value="datacenter">Datacenter</option>
                  </select>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as Plan)}
                    className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Section title="Auth" icon={<LogIn className="h-4 w-4" />}>
            <TestButton
              id="auth-signin"
              label="Sign in as target"
              onClick={testSignIn}
              pendingId={pendingId}
            />
            <Button
              onClick={openTargetInNewTab}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <LogIn className="h-4 w-4" />
              <span className="truncate text-left">
                Open /dashboard in new tab (verify swap)
              </span>
            </Button>
            <TestButton
              id="auth-whoami"
              label="Get current user"
              onClick={testWhoAmI}
              pendingId={pendingId}
              variant="outline"
            />
            <TestButton
              id="auth-signout"
              label="Sign out"
              onClick={testSignOut}
              pendingId={pendingId}
              variant="outline"
              icon={<LogOut className="h-4 w-4" />}
            />
            <TestButton
              id="qa-diagnose"
              label="Diagnose: seed + cookies + dashboard data"
              onClick={testDiagnose}
              pendingId={pendingId}
              variant="outline"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </Section>

          <Section title="Dashboard data" icon={<Activity className="h-4 w-4" />}>
            <TestButton
              id="dash-fetch"
              label="Fetch /api/dashboard"
              onClick={testDashboard}
              pendingId={pendingId}
            />
            <TestButton
              id="proxy-list"
              label={"List " + prettyProxyType(proxyType) + " sessions"}
              onClick={testProxyList}
              pendingId={pendingId}
              variant="outline"
              icon={<Wifi className="h-4 w-4" />}
            />
            <TestButton
              id="proxy-generate"
              label={"Generate 1 " + prettyProxyType(proxyType)}
              onClick={testGenerate}
              pendingId={pendingId}
              variant="outline"
            />
          </Section>

          <Section
            title="Simulate proxy usage"
            icon={<Database className="h-4 w-4" />}
            description="Pushes a fake bandwidth report into the meter for the target user, the way the edge function does in production."
          >
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-700">
                How much usage to report ({usageGb.toFixed(2)} GB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={usageGb}
                  onChange={(e) => setUsageGb(Number(e.target.value) || 0)}
                  className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm"
                />
                <span className="text-xs text-ink-500">GB</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_GB.map((g) => (
                  <button
                    key={g}
                    onClick={() => setUsageGb(g)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-xs transition",
                      usageGb === g
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                    )}
                  >
                    {g >= 1000 ? g / 1000 + " TB" : g + " GB"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-500">
                Sends two report rows (this amount + 40% of it) so you can test
                the 80%-used warning and the over-cap soft-lock without logging
                into the upstream provider.
              </p>
            </div>
            <TestButton
              id="qa-bandwidth"
              label="Send simulated usage report"
              onClick={testBatchBandwidth}
              pendingId={pendingId}
              variant="primary"
            />
          </Section>

          <Section title="Billing / Stripe webhooks" icon={<CircleDollarSign className="h-4 w-4" />}>
            <TestButton
              id="bill-checkout"
              label="Create checkout session"
              onClick={testCheckout}
              pendingId={pendingId}
            />
            <TestButton
              id="wh-checkout"
              label="Simulate checkout.completed"
              onClick={testWebhookCheckout}
              pendingId={pendingId}
              variant="outline"
            />
            <TestButton
              id="wh-paid"
              label="Simulate invoice.paid"
              onClick={testWebhookPaid}
              pendingId={pendingId}
              variant="outline"
            />
            <TestButton
              id="wh-failed"
              label="Simulate invoice.payment_failed"
              onClick={testWebhookFailed}
              pendingId={pendingId}
              variant="outline"
            />
            <TestButton
              id="wh-canceled"
              label="Simulate subscription.deleted"
              onClick={testWebhookCanceled}
              pendingId={pendingId}
              variant="danger"
            />
          </Section>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Response log</CardTitle>
              <CardDescription>
                Most recent 25 calls. Click a row to expand JSON.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLog([])}>
              <RefreshCw className="h-4 w-4" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-ink-500">
              No calls yet - fire a button above.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {log.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function simulateWebhookWrapped(
  user_id: string,
  event: string,
  plan: string,
  proxy_type: string,
  reloadIframe: () => void
) {
  const res = await fetch("/api/qa/webhook-simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, event, plan, proxy_type, amount: 99 }),
  });
  const json = await res.json();
  return {
    ok: res.ok,
    payload: json,
    successBanner: "Webhook " + event + " delivered. Reloading preview.",
    afterSuccess: () => reloadIframe(),
  };
}

function prettyPlan(p: Plan) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function prettyProxyType(t: ProxyType) {
  switch (t) {
    case "rotating_residential":
      return "Rotating Residential";
    case "static_residential":
      return "Static Residential";
    case "datacenter":
      return "Datacenter";
  }
}

function Section({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-500">
          {icon}
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="mt-1 text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2">{children}</CardContent>
    </Card>
  );
}

function TestButton({
  id,
  label,
  onClick,
  pendingId,
  variant = "primary",
  icon,
}: {
  id: string;
  label: string;
  onClick: () => void;
  pendingId: string | null;
  variant?: "primary" | "outline" | "danger";
  icon?: React.ReactNode;
}) {
  const isPending = pendingId === id;
  return (
    <Button
      onClick={onClick}
      variant={variant}
      size="sm"
      loading={isPending}
      disabled={!!pendingId && !isPending}
      className="justify-start"
    >
      {!isPending && (icon ?? <PlayCircle className="h-4 w-4" />)}
      <span className="truncate text-left">{label}</span>
    </Button>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {entry.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span className="truncate text-sm font-medium text-ink-900">
            {entry.label}
          </span>
        </div>
        <div className="shrink-0 text-xs text-ink-500">
          {entry.ts} - {entry.durationMs}ms
        </div>
      </button>
      {open ? (
        <pre
          className={cn(
            "mt-2 max-h-72 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs",
            entry.ok ? "text-ink-700" : "text-rose-700"
          )}
        >
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}
