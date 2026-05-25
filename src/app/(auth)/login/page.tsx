import { GoogleButton } from "@/components/auth/oauth-buttons";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export const metadata = { title: "Log in — OforsonProxies" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
        <p className="text-slate-500 text-sm">Log in to your OforsonProxies account.</p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600"
        >
          {error === "auth_callback_failed"
            ? "We couldn't complete that sign-in. Please try again."
            : "Something went wrong while signing you in. Please try again."}
        </p>
      )}

      <GoogleButton label="Sign in with Google" />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or continue with email</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-brand-600 font-medium hover:underline">
          Sign up free
        </Link>
      </p>
    </div>
  );
}
