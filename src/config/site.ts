export const siteConfig = {
  name: "Oforson Proxies",
  shortName: "Oforson",
  description:
    "Fast, scalable, and reliable proxy infrastructure for scraping, automation, verification, anonymous browsing, and enterprise data collection.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://oforson.dev",
  ogImage: "/og.png",
  links: {
    twitter: "https://twitter.com/oforson",
    github: "https://github.com/oforson",
    docs: "/docs",
    support: "mailto:support@oforson.dev"
  },
  company: {
    legalName: "Oforson Proxies",
    email: "hello@oforson.dev"
  }
};

export type SiteConfig = typeof siteConfig;
