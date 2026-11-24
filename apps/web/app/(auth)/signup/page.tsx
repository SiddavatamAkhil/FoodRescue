"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Building2, HandHeart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, PasswordInput } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PasswordStrength } from "@/components/shared/password-strength";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { passwordChecks } from "@/lib/password";
import { cn } from "@/lib/cn";

type AccountType = "DONOR" | "RECIPIENT" | "VOLUNTEER" | "CORPORATE";

const TYPES: { value: AccountType; label: string; body: string; icon: React.ElementType; orgLabel?: string }[] = [
  { value: "DONOR", label: "Food donor", body: "Restaurant, caterer, hotel, canteen or event venue with surplus food.", icon: Building2, orgLabel: "Business name" },
  { value: "RECIPIENT", label: "NGO / food bank", body: "Registered organisation that serves food to people in need.", icon: HandHeart, orgLabel: "Organisation name" },
  { value: "VOLUNTEER", label: "Volunteer", body: "Collect food from donors and deliver it to NGOs near you.", icon: Truck },
  { value: "CORPORATE", label: "Corporate", body: "Company tracking food rescue across branches for sustainability and CSR reporting.", icon: Briefcase, orgLabel: "Company name" },
];

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const preset = params.get("type") as AccountType | null;
  const [type, setType] = useState<AccountType | null>(TYPES.some((t) => t.value === preset) ? preset : null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", organization_name: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selected = TYPES.find((t) => t.value === type);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.full_name.trim().length < 2) e.full_name = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address.";
    const phone = form.phone.replace(/[\s-]/g, "");
    if (!/^\+?\d{10,13}$/.test(phone)) e.phone = "Enter a 10-digit mobile number, with or without +91.";
    if (selected?.orgLabel && form.organization_name.trim().length < 2) e.organization_name = `Enter your ${selected.orgLabel.toLowerCase()}.`;
    if (!passwordChecks(form.password).every((c) => c.ok)) e.password = "Choose a password that meets all three requirements.";
    if (form.confirm !== form.password) e.confirm = "Passwords don't match.";
    if (!terms) e.terms = "You need to accept the terms to create an account.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    setError("");
    try {
      await api("/auth/register", {
        json: {
          role: type,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          organization_name: selected?.orgLabel ? form.organization_name.trim() : null,
          password: form.password,
          accept_terms: terms,
        },
      });
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      if (!login.ok) {
        router.replace("/login");
        return;
      }
      notify(`Account created. We've sent a confirmation link to ${form.email.trim()}.`);
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.message;
        if (msg.includes("email already exists")) setErrors({ email: "An account with this email already exists. Sign in instead." });
        else if (msg.toLowerCase().includes("phone")) setErrors({ phone: msg });
        else setErrors(err.fieldErrors);
      }
      setError(errorMessage(err).replace("The user with this email already exists.", "An account with this email already exists."));
      setLoading(false);
    }
  }

  if (!type) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-muted">
          Already registered? <Link href="/login" className="link font-semibold">Sign in</Link>
        </p>
        <fieldset className="mt-8">
          <legend className="mb-3 text-sm font-semibold">Which best describes you?</legend>
          <div className="space-y-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className="flex w-full items-start gap-4 rounded-md border border-line-strong bg-surface p-4 text-left transition-colors hover:border-forest hover:bg-forest-50/50"
              >
                <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
                <span>
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-sm text-muted">{t.body}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setType(null)} className="mb-4 text-sm font-semibold text-forest hover:underline">
        Change account type
      </button>
      <h1 className="text-2xl font-semibold">Create a {selected?.label.toLowerCase()} account</h1>
      <p className="mt-1 text-muted">You’ll add {type === "VOLUNTEER" ? "your availability and service area" : "organisation details and documents"} in the next step.</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Full name" error={errors.full_name} required>
          <Input autoComplete="name" value={form.full_name} onChange={set("full_name")} autoFocus />
        </Field>
        {selected?.orgLabel && (
          <Field label={selected.orgLabel} error={errors.organization_name} required>
            <Input autoComplete="organization" value={form.organization_name} onChange={set("organization_name")} />
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email address" error={errors.email} required>
            <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Mobile number" error={errors.phone} required>
            <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
          </Field>
        </div>
        <Field label="Password" error={errors.password} required>
          <PasswordInput autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        <PasswordStrength password={form.password} />
        <Field label="Confirm password" error={errors.confirm} required>
          <PasswordInput autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </Field>
        <div>
          <Checkbox
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-invalid={errors.terms ? true : undefined}
            label={<>I agree to the <Link href="/terms" target="_blank" className="link">Terms of service</Link> and <Link href="/privacy" target="_blank" className="link">Privacy policy</Link>.</>}
          />
          {errors.terms && <p className={cn("mt-1 text-sm font-medium text-danger-text")}>{errors.terms}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Create account</Button>
      </form>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
