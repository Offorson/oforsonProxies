"use client";

import { useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction, updatePasswordAction } from "./actions";

function StatusBanner({ result }: { result: { ok: boolean; error?: string } | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Saved successfully.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {result.error}
    </div>
  );
}

interface ProfileFormProps {
  displayName: string;
  email: string;
}

export function ProfileForm({ displayName, email }: ProfileFormProps) {
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateProfileAction(formData);
      setResult(res);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Profile information visible across Oforson.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Input label="Display name" name="displayName" defaultValue={displayName} required />
          <Input label="Email" type="email" defaultValue={email} disabled
            className="opacity-60 cursor-not-allowed" />
          <p className="text-xs text-ink-400 -mt-2">Email address cannot be changed here.</p>
          <StatusBanner result={result} />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updatePasswordAction(formData);
      setResult(res);
      if (res.ok) formRef.current?.reset();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Use a strong, unique password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
          <Input label="New password" name="newPassword" type="password" autoComplete="new-password" required />
          <Input label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required />
          <StatusBanner result={result} />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
