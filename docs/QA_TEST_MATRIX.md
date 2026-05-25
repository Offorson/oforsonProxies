# Oforson Proxies — QA Test Matrix

A concise, runnable checklist for the testing phase. Pair each row with the **Dashboard → Sandbox** harness (`/dashboard/sandbox`). All test users below come from `006_qa_seed.sql`; the shared password is `TestPass!2026`.

| Email | Role | Plan | Proxy type | Bandwidth state |
|---|---|---|---|---|
| `admin@qa.oforson.test` | admin | — | — | — |
| `pro.res@qa.oforson.test` | user | Pro | Rotating Residential | ~57% used |
| `biz.static@qa.oforson.test` | user | Business | Static Residential | ~31% used |
| `ent.dc@qa.oforson.test` | user | Enterprise | Datacenter | ~20% used |
| `trial.dc@qa.oforson.test` | user | Starter (trialing) | Datacenter | ~5% used |
| `capped@qa.oforson.test` | user | Pro (past_due) | Rotating Residential | **108% — OVER CAP** |

---

## 1. Auth

| # | Test | Expected |
|---|---|---|
| A1 | Sign in as each seeded user via harness | `session: true`, `user.email` matches |
| A2 | Sign in with bad password | `error.message: "Invalid login credentials"` |
| A3 | Sign in with `pending_verification` profile | redirected/blocked per app rules |
| A4 | `getUser` after sign-in | non-null user |
| A5 | Sign out → `getUser` | `user: null` |
| A6 | Hit `/dashboard` while signed out | middleware redirects to `/login?next=…` |
| A7 | Hit `/dashboard/sandbox` as non-admin in **production** build | redirect to `/dashboard` |
| A8 | Hit `/dashboard/sandbox` in dev as any user | renders harness |

## 2. Dashboard data routing (the big one)

| # | Test | Expected |
|---|---|---|
| D1 | Sign in as `pro.res` → fetch `/api/dashboard` | `subscription.proxy_type = rotating_residential`, `bandwidth_used_gb ≈ 428.6`, 3 active sessions |
| D2 | Sign in as `biz.static` → fetch `/api/dashboard` | `subscription.proxy_type = static_residential`, 2 active sessions, 7‑day chart is **non-zero** |
| D3 | Sign in as `ent.dc` → fetch `/api/dashboard` | `subscription.proxy_type = datacenter`, 4 active sessions, large per‑day GB numbers |
| D4 | Sign in as `trial.dc` → fetch `/api/dashboard` | `status = trialing`, low usage, 1 active session |
| D5 | List proxies, filter to `rotating_residential` while signed in as `biz.static` | empty list (no rotating sessions on that user) — confirms routing by user, not just type |
| D6 | Generate 1 datacenter while signed in as `pro.res` | succeeds OR cleanly rejects per plan rules (write down current behavior) |
| D7 | Dashboard for `capped` user | `bandwidth_used_gb > bandwidth_gb`, banner/alert visible |
| D8 | Dashboard for user with **no** subscription (delete row then re-fetch) | `subscription: null`, no JS crash, charts render zero state |
| D9 | Force timeout: stop Supabase, fetch dashboard | fallback empty payload returned in ≤4s, no 500 |

## 3. Bandwidth + edge function

| # | Test | Expected |
|---|---|---|
| B1 | Batch report 5 GB for `pro.res` | `bandwidth_used_gb` increases by ~7 GB (5 + 2 from second row), `over_cap: false` |
| B2 | Batch report 400 GB for `trial.dc` | trial flips into `over_cap: true` summary |
| B3 | Batch report with negative bytes | 400 from Zod validation |
| B4 | Batch report with 501 rows | 400 (max 500) |
| B5 | Batch report as non-admin user | 403 FORBIDDEN |
| B6 | Batch report with mismatched proxy_type vs subscription | row still inserts (usage is just metering); user’s totals reflect it |
| B7 | After B1 — re-fetch `/api/dashboard` for that user | today's bucket in `bandwidthUsed7d` shows the new GB |
| B8 | `proxy_sessions` count unaffected by usage report | still equal to active rows |

## 4. Billing + Stripe webhook

| # | Test | Expected |
|---|---|---|
| C1 | `POST /api/billing/checkout` while signed in | returns a `url` containing the planId & user id |
| C2 | `POST /api/billing/checkout` while signed out | 401 |
| C3 | Simulate `checkout.session.completed` for `trial.dc` upgrading to `business` | subscription row updated: plan=business, bandwidth_gb=2000, status=active, used reset to 0 |
| C4 | Simulate `invoice.paid` | new row in `payment_history` (status: succeeded) |
| C5 | Simulate `invoice.payment_failed` for `pro.res` | new failed row in `payment_history`, subscription.status → `past_due` |
| C6 | Simulate `customer.subscription.deleted` | subscription.status → `canceled`; dashboard banner reflects it |
| C7 | After C3 — fetch dashboard for `trial.dc` | plan/bandwidth update visible immediately |
| C8 | Webhook with bad event name | 400 from Zod |
| C9 | Webhook with unknown user_id | inserts succeed (FK is on user_id → profiles), or fails cleanly with 400 — confirm expected |
| C10 | Repeatedly fire `invoice.paid` | each call creates an additional history row (idempotency is **not** yet implemented — note for when Stripe real wire-up lands) |

## 5. Mobile / desktop / tablet

| # | Test | Expected |
|---|---|---|
| M1 | Toggle harness to **mobile (390px)** | dashboard chrome collapses sidebar, charts reflow, no horizontal scroll |
| M2 | Toggle to **tablet (768px)** | grid columns relax, sidebar visible |
| M3 | Toggle to **desktop (1280px)** | full sidebar + multi-column dashboard |
| M4 | At each viewport: open `/dashboard/billing` in the iframe | progress bar, plan card, invoice table all readable, no overflow |
| M5 | At each viewport: open `/dashboard/proxies` | session list scrolls vertically, generate CTA visible |
| M6 | Marketing `/` at mobile | hero, pricing, FAQ all stack cleanly |

## 6. RLS + cross-tenant safety

| # | Test | Expected |
|---|---|---|
| R1 | Signed in as `pro.res`, try `supabase.from("subscriptions").select("*")` from browser | only `pro.res`'s row(s) returned |
| R2 | Same, but `proxy_sessions` | only own rows |
| R3 | Hit `/api/proxies/list` while signed in as `biz.static`; inspect payload | no rows belonging to other QA users leak |
| R4 | Non-admin hits `/api/qa/bandwidth-batch` | 403 |
| R5 | Anonymous hits `/api/qa/webhook-simulate` | 401 |

## 7. Error & empty states

| # | Test | Expected |
|---|---|---|
| E1 | Delete every `bandwidth_usage` row for a user, reload dashboard | 7-day chart shows zero bars, not an empty/broken chart |
| E2 | Set `subscription.status = "expired"` manually, reload | UI shows expired banner, "Upgrade" CTA |
| E3 | Network throttled (Slow 3G) on dashboard load | loading skeleton shows, then content, no hard timeout error |
| E4 | Invalid JSON to a POST route | 400 with a parseable error message |
| E5 | Capped user attempts to generate a new proxy | rejected with a clear "limit reached" message (or — flag this as a TODO if not implemented yet) |

---

## Run order (suggested)

1. Apply migrations 001 → 005 in Supabase, then `006_qa_seed.sql`.
2. `npm run dev`, sign in as `admin@qa.oforson.test`, go to **/dashboard/sandbox**.
3. Walk Auth (1) → Dashboard (2) → Bandwidth (3) → Billing (4).
4. Switch viewport between each section to fold (5) into the previous runs.
5. RLS (6) and edge cases (7) last — they're the ones most likely to reveal real bugs.
