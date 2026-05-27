"use client";

import { useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  updateProfileAction,
  updatePasswordAction,
  requestAccountDeletionAction,
} from "./actions";

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

interface DeleteAccountCardProps {
  email: string;
}

export function DeleteAccountCard({ email }: DeleteAccountCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmText.trim().toLowerCase() === "delete";

  function handleConfirm() {
    setResult(null);
    startTransition(async () => {
      const res = await requestAccountDeletionAction();
      setResult(res);
    });
  }

  function closeModal() {
    if (isPending) return;
    setOpen(false);
    setConfirmText("");
    setResult(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-rose-700">Danger zone</CardTitle>
          <CardDescription>Permanent account actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={closeModal}
        title="Delete your account?"
        description="This permanently removes your account, proxies, sessions and billing history."
      >
        {result?.ok ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              We sent a confirmation link to <strong>{email}</strong>. Click it to
              finish deleting your account. The link expires in 1 hour.
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={closeModal}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm text-ink-700">
            <p>
              We&apos;ll email <strong>{email}</strong> a confirmation link. Your
              account is only deleted once you click that link.
            </p>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">
                Type <span className="font-mono">delete</span> to confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete"
                autoComplete="off"
              />
            </div>
            {result && !result.ok && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {result.error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeModal} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirm}
                disabled={!canConfirm || isPending}
              >
                {isPending ? "Sending…" : "Email confirmation link"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
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
