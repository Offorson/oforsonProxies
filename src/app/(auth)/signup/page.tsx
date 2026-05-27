import { GoogleButton } from "@/components/auth/oauth-buttons";
import { SignupForm } from "@/components/auth/signup-form";
import Link from "next/link";

export const metadata = { title: "Create account OforsonProxies" };

export default function SignupPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
        <p className="text-slate-500 text-sm">
          Start with 1 GB free no credit card required.
        </p>
      </div>

      <GoogleButton label="Sign up with Google" />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or sign up with email</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
 