import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: [
    "residential proxies",
    "rotating proxies",
    "datacenter proxies",
    "proxy api",
    "web scraping",
    "automation",
    "Oforson Proxies"
  ],
  authors: [{ name: "Oforson Proxies" }],
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
    // attributes like data-gr-ext-installed onto <html>/<body> before React
    // hydrates. That is harmless but trips Next's hydration mismatch check,
    // so the warning is suppressed one level deep on these two elements only.
    <html lang="en" className="bg-white" suppressHydrationWarning>
      <body
        className="min-h-screen bg-white text-ink-900 antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
