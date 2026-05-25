import { MailCheck } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Verify your email — OforsonProxies" };

export default function VerifyEmailPage() {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 mb-6">
        <MailCheck className="h-8 w-8 text-brand-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your inbox</h1>
      <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
        We&apos;ve sent a confirmation link to your email address. Click it to activate your account.
      </p>
      <p className="text-xs text-slate-400 mb-4">
        Didn&apos;t receive it? Check your spam folder.
      </p>
      <Link
        href="/dashboard"
        className="text-sm text-brand-600 font-medium hover:underline"
      >
        Already verified? Go to dashboard →
      </Link>
    </div>
  );
}
