import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const features = [
  "Residential, ISP & datacenter proxies in one dashboard",
  "Global country coverage",
  "Zero-log policy — your traffic stays private",
  "Fast, stable connections",
  "Instant provisioning — no waiting period",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-12 py-10 relative overflow-hidden shrink-0">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
        {/* Top */}
        <div className="relative z-10 flex flex-col items-start gap-7">
          <Logo dark />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
        {/* Middle */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            The proxy infrastructure<br />built for scale.
          </h2>
          <p className="text-slate-400 text-base mb-8">
            Built for developers, scrapers, and data teams that need proxies
            they can rely on.
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-slate-300 text-sm">
                <CheckCircle2 className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        {/* Bottom spacer */}
        <div className="relative z-10" />
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
