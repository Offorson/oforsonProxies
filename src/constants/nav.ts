// Nav data is plain JSON only — no function references.
// Server Components can't pass functions (including React components like
// lucide icons) to Client Components in Next.js 15. The Sidebar maps these
// string keys to icon components on the client.

export type NavIconKey =
  | "dashboard"
  | "globe"
  | "activity"
  | "wifi"
  | "key"
  | "credit-card"
  | "settings"
  | "users"
  | "boxes"
  | "trending-up"
  | "scroll"
  | "lifebuoy"
  | "heart-pulse"
  | "megaphone"
  | "shield";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconKey;
}

export const MARKETING_NAV = [
  { label: "Products", href: "/#products" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" }
];

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "dashboard" },
  { label: "Proxies", href: "/dashboard/proxies", icon: "globe" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "activity" },
  { label: "Sessions", href: "/dashboard/sessions", icon: "wifi" },
  { label: "API Keys", href: "/dashboard/api", icon: "key" },
  { label: "Billing", href: "/dashboard/billing", icon: "credit-card" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" }
  // Hidden — internal QA harness. Restore by un-commenting the line below
  // and re-enabling src/app/(dashboard)/dashboard/sandbox/page.tsx.
  // { label: "Sandbox", href: "/dashboard/sandbox", icon: "heart-pulse" }
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "dashboard" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Inventory", href: "/admin/inventory", icon: "boxes" },
  { label: "Revenue", href: "/admin/revenue", icon: "trending-up" },
  { label: "Audit Logs", href: "/admin/audit", icon: "scroll" },
  { label: "Support", href: "/admin/support", icon: "lifebuoy" },
  { label: "Monitoring", href: "/admin/monitoring", icon: "heart-pulse" },
  { label: "Announcements", href: "/admin/announcements", icon: "megaphone" }
];

// Appended to DASHBOARD_NAV for admin accounts so the admin area is
// reachable from the normal dashboard sidebar.
export const ADMIN_LINK: NavItem = { label: "Admin", href: "/admin", icon: "shield" };

export const FOOTER_NAV = [
  {
    title: "Product",
    links: [
      { label: "Static Residential", href: "/products/residential-static" },
      { label: "Rotating Residential", href: "/products/residential-rotating" },
      { label: "Datacenter", href: "/products/datacenter" },
      { label: "Pricing", href: "/pricing" }
    ]
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs#api" },
      { label: "Status", href: "/docs#status" },
      { label: "Changelog", href: "/docs#changelog" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "#" },
      { label: "Blog", href: "#" }
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "AUP", href: "/legal/terms" },
      { label: "DPA", href: "/legal/privacy" }
    ]
  }
];
