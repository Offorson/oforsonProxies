# Oforson Proxies

Premium residential & datacenter proxy SaaS platform — built with Next.js 15, TypeScript, Tailwind CSS, Framer Motion, and Supabase.

A production-grade web application for selling Static Residential, Rotating Residential, and Datacenter proxies — designed to look and feel like a funded enterprise SaaS startup.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Recharts · Lucide Icons
- **Backend**: Next.js API routes · Supabase (PostgreSQL · Auth · RLS)
- **Integrations**: Webshare API (Static Residential, Rotating Residential, Datacenter), Stripe (Billing)
- **State / Data**: @tanstack/react-query, Zod

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Then edit .env.local with your Supabase, Webshare, Stripe keys

# 3. Run the database migrations
# Open Supabase SQL editor and run files in this order from src/database/migrations/:
#   001_init_schema.sql
#   002_rls_policies.sql
#   003_seed_data.sql (optional, for demo data)

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
oforson-proxies/
├── public/                        # Static assets (logos, images)
├── src/
│   ├── app/
│   │   ├── (marketing)/           # Public landing, products, pricing, docs
│   │   ├── (auth)/                # Login, signup, forgot password, verify email
│   │   ├── (dashboard)/           # Authenticated user dashboard
│   │   ├── (admin)/               # Admin panel
│   │   ├── api/                   # API routes (proxies, billing, admin, integrations)
│   │   ├── globals.css            # Global styles & Tailwind layers
│   │   └── layout.tsx             # Root layout
│   ├── components/
│   │   ├── ui/                    # Buttons, Card, Input, Modal, Badge, etc.
│   │   ├── layout/                # Navbar, Footer, Sidebar, TopBar
│   │   ├── marketing/             # Hero, ProductsGrid, Pricing, FAQ, Testimonials
│   │   ├── dashboard/             # Dashboard widgets & sections
│   │   ├── admin/                 # Admin tables, monitoring widgets
│   │   ├── auth/                  # Auth forms
│   │   ├── animations/            # Framer Motion wrappers
│   │   └── charts/                # Recharts wrappers
│   ├── lib/
│   │   ├── supabase/              # Supabase server + browser clients
│   │   ├── api/                   # Webshare service client (sole proxy provider)
│   │   └── auth/                  # Auth helpers, session, role guards
│   ├── hooks/                     # React hooks (useUser, useProxies, etc.)
│   ├── services/                  # Higher-level business services
│   ├── constants/                 # Pricing, countries, nav, plans
│   ├── utils/                     # cn(), formatters, validators
│   ├── types/                     # Shared TypeScript types
│   ├── styles/                    # Additional styles
│   ├── config/                    # Site config
│   └── database/
│       ├── migrations/            # Numbered SQL migrations
│       └── seed/                  # Seed scripts
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## Database (Supabase)

Run the SQL files in `src/database/migrations/` in numeric order in the Supabase SQL editor.

**Tables**

- `profiles` — user profiles with `is_admin`, `account_status`
- `subscriptions` — active plans
- `proxy_orders` — purchases
- `proxy_sessions` — live sessions
- `bandwidth_usage` — usage records
- `api_keys` — user-generated keys
- `payment_history` — invoices & charges
- `support_tickets` — support queue
- `notifications` — per-user inbox
- `system_announcements` — broadcast messages
- `admin_audit_logs` — admin action trail

**Row Level Security** is enabled on every table. Regular users can only read/write their own rows; admins (`profiles.is_admin = true`) can read/write everything via security-definer helper functions.

## Roles

- **User** — purchases plans, generates proxies, manages API keys, views analytics.
- **Admin** — full user management, inventory oversight, revenue analytics, audit logs, support, monitoring, broadcast notifications.

To promote a user to admin, update `profiles.is_admin = true` for their row in Supabase.

## Provider Integration

Webshare is the sole upstream provider for every proxy product.

- `src/lib/api/webshare.ts` — wraps the Webshare REST API. `listProxies` serves static residential + datacenter from the allocated proxy list; `buildResidentialGateway` serves rotating residential from Webshare's residential rotating gateway with country targeting and sticky-session pinning.
- `src/services/proxies.ts` — provider-agnostic provisioning layer that routes each proxy type to the right Webshare path. The upstream provider is never surfaced to end users.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript without emitting |

## Design Principles

White-first premium SaaS aesthetic — Stripe / Vercel / Linear inspired. Cyan-to-blue accents, glassmorphism cards, soft shadows, generous whitespace, and elegant Framer Motion animations throughout.

## License

Proprietary © Oforson Proxies.
