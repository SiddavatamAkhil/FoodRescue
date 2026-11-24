"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PasswordStrength } from "@/components/shared/password-strength";
import { api, errorMessage } from "@/lib/api";
import { passwordChecks } from "@/lib/password";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <>
        <h1 className="text-2xl font-semibold">This reset link is incomplete</h1>
        <p className="mt-2 text-muted">Open the link from your email again, or request a new one.</p>
        <p className="mt-6"><Link href="/forgot-password" className="link font-semibold">Request a new link</Link></p>
      </>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!passwordChecks(pw).every((c) => c.ok)) errs.pw = "Choose a password that meets all three requirements.";
    if (pw !== confirm) errs.confirm = "Passwords don't match.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError("");
    try {
      await api("/auth/reset-password", { json: { token, password: pw } });
      router.replace("/login?reset=1");
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {error && (
          <Alert tone="danger" action={<Link href="/forgot-password" className="text-sm font-semibold text-forest hover:underline">New link</Link>}>
            {error}
          </Alert>
        )}
        <Field label="New password" error={errors.pw}>
          <PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </Field>
        <PasswordStrength password={pw} />
        <Field label="Confirm new password" error={errors.confirm}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
