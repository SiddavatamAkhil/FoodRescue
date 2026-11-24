"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PageIntro } from "@/components/marketing/page-intro";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { api, ApiError, errorMessage } from "@/lib/api";

const topics = [
  { value: "donor", label: "I have surplus food to donate" },
  { value: "ngo", label: "I run an NGO or food bank" },
  { value: "volunteer", label: "I want to volunteer" },
  { value: "corporate", label: "Corporate or CSR partnership" },
  { value: "support", label: "Help with my account" },
  { value: "other", label: "Something else" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", organization: "", topic: "donor", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) errs.message = "Tell us a little more (at least 10 characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus("sending");
    setError("");
    try {
      await api("/contact/", { json: { ...form, organization: form.organization || null } });
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageIntro title="Contact us">
        Questions about joining, a partnership, or your account. Messages go to the FoodRescue operations team.
      </PageIntro>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-[1.2fr_0.8fr]">
        {status === "sent" ? (
          <div className="rounded-md border border-line bg-surface p-8">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden />
            <h2 className="mt-3 text-xl font-semibold">Message sent</h2>
            <p className="mt-1 text-muted">Thanks, {form.name.split(" ")[0]}. We’ll reply to {form.email}.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5 rounded-md border border-line bg-surface p-6 sm:p-8">
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" error={errors.name} required><Input value={form.name} onChange={set("name")} autoComplete="name" /></Field>
              <Field label="Email address" error={errors.email} required><Input type="email" value={form.email} onChange={set("email")} autoComplete="email" /></Field>
            </div>
            <Field label="Organisation" optional><Input value={form.organization} onChange={set("organization")} autoComplete="organization" /></Field>
            <Field label="What is this about?"><Select value={form.topic} onChange={set("topic")}>{topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
            <Field label="Message" error={errors.message} required><Textarea rows={6} value={form.message} onChange={set("message")} /></Field>
            <Button type="submit" loading={status === "sending"}>Send message</Button>
          </form>
        )}
        <aside className="space-y-6 text-sm">
          <div>
            <h2 className="font-semibold">Need help with a live rescue?</h2>
            <p className="mt-1 text-muted">Sign in and use <strong>Report an issue</strong> on the donation. It goes straight to the operations queue with the rescue attached.</p>
          </div>
          <div>
            <h2 className="font-semibold">Want to join?</h2>
            <p className="mt-1 text-muted">You don’t need to contact us first. <a href="/signup" className="link">Create an account</a> and complete onboarding; we review every organisation before it can publish or claim food.</p>
          </div>
        </aside>
      </section>
    </>
  );
}
