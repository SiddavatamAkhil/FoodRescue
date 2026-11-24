"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError("Enter the email address you signed up with.");
      return;
    }
    setFieldError("");
    setLoading(true);
    setError("");
    try {
      await api("/auth/forgot-password", { json: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <MailCheck className="h-8 w-8 text-forest" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-muted">
          If an account exists for <strong className="text-ink">{email.trim()}</strong>, we’ve sent a link to reset the password.
          The link works once and expires in 30 minutes.
        </p>
        <p className="mt-6 text-sm"><Link href="/login" className="link font-semibold">Back to sign in</Link></p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-muted">Enter your email and we’ll send you a link to choose a new password.</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email address" error={fieldError}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
        <p className="text-sm"><Link href="/login" className="link font-semibold">Back to sign in</Link></p>
      </form>
    </>
  );
}
