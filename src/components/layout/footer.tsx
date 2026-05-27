import Link from "next/link";
import { Twitter, Github, Linkedin } from "lucide-react";
import { Logo } from "./logo";
import { FOOTER_NAV } from "@/constants/nav";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-ink-50/50">
      <div className="container mx-auto py-16">
        <div className="grid gap-12 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-ink-600 leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="mt-6 flex items-center gap-2">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="rounded-lg border border-ink-200 bg-white p-2 text-ink-500 hover:text-brand-600 hover:border-brand-300 transition"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_NAV.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold text-ink-900">{group.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-600 hover:text-brand-600 transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-ink-200 pt-8">
          <p className="text-sm text-ink-500">
            &copy; {new Date().getFullYear()} {siteConfig.company.legalName}. All rights reserved.
          </p>
          <p className="text-xs text-ink-500">
            Residential, ISP &amp; datacenter proxies.
          </p>
        </div>
      </div>
    </footer>
  );
}
