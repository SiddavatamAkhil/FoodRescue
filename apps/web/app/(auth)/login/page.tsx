"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, PasswordInput } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { homeFor } from "@/lib/session";
import type { Role } from "@/lib/types";

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const notice = params.get("expired")
    ? { tone: "warning" as const, text: "Your session has ended. Sign in again to continue." }
    : params.get("signed_out")
      ? { tone: "success" as const, text: "You've signed out." }
      : params.get("reset")
        ? { tone: "success" as const, text: "Your password has been updated. Sign in with the new password." }
        : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter the email address you signed up with.";
    if (!password) errs.password = "Enter your password.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && data.detail === "Incorrect email or password") {
          setError("That email and password don't match an account. Check them and try again.");
        } else if (res.status === 400 && data.detail === "Inactive user account") {
          setError("This account has been deactivated. Contact support if you think this is a mistake.");
        } else {
          setError(typeof data.detail === "string" ? data.detail : "Sign-in failed. Try again.");
        }
        setLoading(false);
        return;
      }
      const dest = safeNext(params.get("next")) ?? homeFor({ role: data.role as Role, onboarding_completed: data.onboarding_completed });
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Can't reach FoodRescue. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-muted">
        New to FoodRescue? <Link href="/signup" className="link font-semibold">Create an account</Link>
      </p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email address" error={errors.email}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Keep me signed in for 7 days" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link href="/forgot-password" className="shrink-0 text-sm font-semibold text-forest hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
        <p className="text-xs text-muted">Only use “keep me signed in” on a device you don’t share.</p>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
