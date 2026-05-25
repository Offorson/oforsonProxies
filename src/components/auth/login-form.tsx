"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction, type AuthState } from "@/app/(auth)/actions";
import { SubmitButton } from "./signup-form";
import { PasswordInput } from "./password-input";

const initialState: AuthState | null = null;
const inputClasses =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition";

export function LoginForm() {
  const [state, formAction] = useActionState(signInAction, initialState);
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect_to") ?? "/dashboard";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="redirect_to" value={redirectTo} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email <span className="text-rose-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
          required
          className={inputClasses}
        />
      </div>

      <PasswordInput
        name="password"
        placeholder="Enter your password"
        autoComplete="current-password"
        minLength={1}
      />

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            name="remember"
            className="rounded border-slate-300 accent-brand-500"
          />
          Keep me logged in
        </label>
        <Link href="/forgot-password" className="text-brand-600 font-medium hover:underline">
          Forgot password
        </Link>
      </div>

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600"
        >
          {state.error}
        </p>
      )}

      <SubmitButton label="Sign in" />
    </form>
  );
}
