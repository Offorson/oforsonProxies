"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type AuthState } from "@/app/(auth)/actions";
import { PasswordInput } from "./password-input";

const initialState: AuthState | null = null;

const inputClasses =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition";

export function SignupForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  if (state?.ok && state.needsConfirmation) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Check your inbox</h2>
        <p className="text-slate-500 text-sm">
          We sent a confirmation link to your email. Click it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field label="Username" name="username" required>
        <input
          type="text"
          name="username"
          autoComplete="username"
          placeholder="Choose a username"
          required
          minLength={3}
          className={inputClasses}
        />
      </Field>
      <Field label="Email" name="email" required>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
          required
          className={inputClasses}
        />
      </Field>
      <PasswordInput
        name="password"
        placeholder="Create a password (min 8 chars)"
        autoComplete="new-password"
        minLength={8}
      />
      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600"
        >
          {state.error}
        </p>
      )}
      <SubmitButton label="Create account" />
      <p className="text-center text-xs text-slate-400">
        By signing up you agree to our{" "}
        <a href="/legal/terms" className="underline hover:text-slate-600">Terms</a>
        {" "}and{" "}
        <a href="/legal/privacy" className="underline hover:text-slate-600">Privacy Policy</a>.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {pending && (
        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      )}
      {pending ? "Working..." : label}
    </button>
  );
}
