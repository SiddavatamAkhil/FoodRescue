"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Checkbox } from "@/components/ui/field";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { VerificationBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { LocationPicker, emptyLocation, type LocationValue } from "@/components/shared/location-picker";
import { VolunteerForm } from "@/components/shared/volunteer-form";
import { CategoryPicker } from "@/components/shared/category-picker";
import { DocumentUpload } from "@/components/shared/document-upload";
import { api, ApiError, errorMessage } from "@/lib/api";
import { homeFor, signOut, useMe, ROLE_LABEL } from "@/lib/session";
import { BUSINESS_CATEGORIES } from "@/lib/places";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/cn";

const REQUIRED_DOCS: Record<string, string[]> = {
  DONOR: ["fssai_license"],
  RECIPIENT: ["ngo_registration"],
  CORPORATE: ["gst_certificate"],
};

function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Onboarding progress">
      {steps.map((s, i) => (
        <li key={s} className={cn("flex items-center gap-2 font-semibold", i === current ? "text-ink" : i < current ? "text-forest" : "text-muted")} aria-current={i === current ? "step" : undefined}>
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-xs", i < current ? "border-forest bg-forest text-white" : i === current ? "border-forest text-forest" : "border-line-strong")}>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function locationPayload(loc: LocationValue) {
  return { address: loc.address.trim(), city: loc.city, latitude: loc.latitude, longitude: loc.longitude };
}

function validateLocation(loc: LocationValue, e: Record<string, string>) {
  if (loc.address.trim().length < 5) e["location.address"] = "Enter the full street address.";
  if (!loc.city) e["location.city"] = "Choose the city.";
}

function locErrors(errors: Record<string, string>) {
  return { address: errors["location.address"], city: errors["location.city"], latitude: errors["location.latitude"] };
}

const phoneOk = (p: string) => /^\+?\d{10,13}$/.test(p.replace(/[\s-]/g, ""));

// ---------------------------------------------------------------------------

function OrgForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const role = me.role as "DONOR" | "RECIPIENT" | "CORPORATE";
  const org = me.organization;
  const p = (org?.profile ?? {}) as Record<string, string | string[] | number | undefined>;
  const [name, setName] = useState(org?.name ?? (me.profile.organization_name as string) ?? "");
  const [category, setCategory] = useState((p.business_category as string) ?? "");
  const [industry, setIndustry] = useState((p.industry as string) ?? "");
  const [cin, setCin] = useState((p.cin_or_gstin as string) ?? "");
  const [registration, setRegistration] = useState(org?.ngo_darpan_id ?? "");
  const [fssai, setFssai] = useState(org?.fssai_number ?? "");
  const [contactName, setContactName] = useState((p.contact_name as string) ?? (p.representative_name as string) ?? me.full_name);
  const [designation, setDesignation] = useState((p.representative_designation as string) ?? "");
  const [contactPhone, setContactPhone] = useState((p.contact_phone as string) ?? me.phone ?? "");
  const [contactEmail, setContactEmail] = useState((p.contact_email as string) ?? me.email);
  const [hours, setHours] = useState((p.operating_hours as string) ?? "");
  const [capacity, setCapacity] = useState(org?.daily_capacity ? String(org.daily_capacity) : "");
  const [areas, setAreas] = useState(((p.operating_locations as string[]) ?? []).join(", "));
  const [cats, setCats] = useState<string[]>((p.food_categories as string[]) ?? []);
  const [loc, setLoc] = useState<LocationValue>(
    org ? { address: org.address, city: (p.city as string) ?? "", latitude: org.latitude, longitude: org.longitude, precise: true } : emptyLocation,
  );
  const [confirm, setConfirm] = useState(!!org);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter the registered name.";
    validateLocation(loc, e);
    if (contactName.trim().length < 2) e.contact_name = "Enter a contact name.";
    if (!phoneOk(contactPhone)) e.contact_phone = "Enter a 10-digit mobile number.";
    if (fssai && !/^\d{14}$/.test(fssai)) e.fssai_number = "FSSAI numbers have 14 digits.";
    if (role === "DONOR") {
      if (!category) e.business_category = "Choose a category.";
      if (hours.trim().length < 3) e.operating_hours = "Enter your operating hours.";
      if (!cats.length) e.food_categories = "Select at least one food category.";
    }
    if (role === "RECIPIENT") {
      if (registration.trim().length < 3) e.registration_number = "Enter your registration number.";
      if (!(Number(capacity) >= 1)) e.daily_meal_capacity = "Enter how many meals you can receive per day.";
      if (!cats.length) e.food_categories = "Select at least one food category.";
    }
    if (role === "CORPORATE") {
      if (industry.trim().length < 2) e.industry = "Enter your industry.";
      if (designation.trim().length < 2) e.representative_designation = "Enter the representative's designation.";
      if (!/^\S+@\S+\.\S+$/.test(contactEmail)) e.contact_email = "Enter a valid email address.";
    }
    if (!confirm) e.confirm = "Confirm that you are authorised to register this organisation.";
    setErrors(e);
    if (Object.keys(e).length) {
      setError("Some details need attention.");
      return;
    }
    const location = locationPayload(loc);
    const payload =
      role === "DONOR"
        ? { business_name: name.trim(), business_category: category, location, contact_name: contactName.trim(), contact_phone: contactPhone, fssai_number: fssai || null, operating_hours: hours.trim(), food_categories: cats }
        : role === "RECIPIENT"
          ? { organization_name: name.trim(), registration_number: registration.trim(), fssai_number: fssai || null, location, operating_locations: areas.split(",").map((a) => a.trim()).filter(Boolean), contact_name: contactName.trim(), contact_phone: contactPhone, daily_meal_capacity: Number(capacity), food_categories: cats }
          : { company_name: name.trim(), industry: industry.trim(), cin_or_gstin: cin.trim() || null, location, representative_name: contactName.trim(), representative_designation: designation.trim(), contact_email: contactEmail.trim(), contact_phone: contactPhone, branches: (p.branches as unknown[]) ?? [] };
    setSaving(true);
    setError("");
    try {
      await api("/auth/onboarding", { json: payload });
      onDone();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const nameLabel = role === "DONOR" ? "Business name" : role === "RECIPIENT" ? "Registered organisation name" : "Company name";

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {error && <Alert tone="danger">{error}</Alert>}
      <section className="space-y-5">
        <h2 className="text-lg font-semibold">{role === "CORPORATE" ? "Company" : "Organisation"}</h2>
        <Field label={nameLabel} error={errors.name || errors.business_name || errors.organization_name || errors.company_name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {role === "DONOR" && (
          <Field label="Business category" error={errors.business_category}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        )}
        {role === "CORPORATE" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Industry" error={errors.industry}><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Hospitality, food processing" /></Field>
            <Field label="CIN or GSTIN" optional error={errors.cin_or_gstin}><Input value={cin} onChange={(e) => setCin(e.target.value)} /></Field>
          </div>
        )}
        {role === "RECIPIENT" && (
          <Field label="Registration number" error={errors.registration_number} hint="NGO Darpan ID, trust deed or society registration number.">
            <Input value={registration} onChange={(e) => setRegistration(e.target.value)} />
          </Field>
        )}
        {role !== "CORPORATE" && (
          <Field label="FSSAI registration or licence number" optional={role === "RECIPIENT"} error={errors.fssai_number} hint={role === "DONOR" ? "Required before you can publish listings. 14 digits." : "If your kitchen or food bank holds one."}>
            <Input value={fssai} onChange={(e) => setFssai(e.target.value.replace(/\D/g, "").slice(0, 14))} inputMode="numeric" />
          </Field>
        )}
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">{role === "DONOR" ? "Pickup location" : role === "RECIPIENT" ? "Main address" : "Registered office"}</h2>
        <LocationPicker value={loc} onChange={setLoc} errors={locErrors(errors)} />
        {role === "RECIPIENT" && (
          <Field label="Other operating locations" optional hint="Separate with commas, e.g. Benz Circle shelter, Gunadala kitchen.">
            <Input value={areas} onChange={(e) => setAreas(e.target.value)} />
          </Field>
        )}
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">{role === "CORPORATE" ? "Authorised representative" : "Contact for pickups"}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" error={errors.contact_name || errors.representative_name}><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
          {role === "CORPORATE" ? (
            <Field label="Designation" error={errors.representative_designation}><Input value={designation} onChange={(e) => setDesignation(e.target.value)} /></Field>
          ) : (
            <Field label="Phone" error={errors.contact_phone}><Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
          )}
        </div>
        {role === "CORPORATE" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Business email" error={errors.contact_email}><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
            <Field label="Business phone" error={errors.contact_phone}><Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
          </div>
        )}
        {role === "DONOR" && (
          <Field label="Operating hours" error={errors.operating_hours} hint="When someone can collect food, e.g. 11:00–23:00 daily.">
            <Input value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        )}
      </section>

      {role !== "CORPORATE" && (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Food</h2>
          <CategoryPicker legend={role === "DONOR" ? "What kinds of surplus do you usually have?" : "What food can you accept?"} value={cats} onChange={setCats} error={errors.food_categories} />
          {role === "RECIPIENT" && (
            <Field label="Daily meal capacity" error={errors.daily_meal_capacity} hint="The most meals you can safely receive and serve in one day. Claims above this are declined.">
              <Input type="number" min={1} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="max-w-[12rem]" />
            </Field>
          )}
        </section>
      )}

      <div className="space-y-5 border-t border-line pt-6">
        <div>
          <Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} label="I am authorised to register this organisation, and the details above are accurate." />
          {errors.confirm && <p className="mt-1 text-sm font-medium text-danger-text">{errors.confirm}</p>}
        </div>
        <Button type="submit" size="lg" loading={saving}>Save and continue</Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const { data: me, isLoading, refetch, error } = useMe();
  const [step, setStep] = useState(0);

  const checked = useRef(false);
  useEffect(() => {
    // Decide where to start only once; later profile refreshes must not move the user mid-flow.
    if (!me || checked.current) return;
    checked.current = true;
    if (me.role === "ADMIN" || me.role === "OPS_MANAGER") router.replace("/dashboard/admin");
    else if (params.get("step") === "documents" && me.organization) setStep(1);
    else if (me.onboarding_completed && params.get("edit") !== "1") router.replace(homeFor(me));
  }, [me, params, router]);

  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (isLoading || !me) {
    return <div className="space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full" /></div>;
  }

  const isOrg = me.role !== "VOLUNTEER";
  const steps = isOrg ? ["Organisation details", "Verification documents", "Review"] : ["Profile and availability"];

  return (
    <>
      <p className="text-sm font-semibold text-forest">{ROLE_LABEL[me.role]} account</p>
      <h1 className="mt-1 text-2xl font-semibold">
        {step === 0 ? (isOrg ? "Tell us about your organisation" : "Set up your volunteer profile") : step === 1 ? "Upload verification documents" : "You're all set"}
      </h1>
      <p className="mb-8 mt-1 max-w-prose text-muted">
        {step === 0 && isOrg && "We use these details to verify your organisation and to match food by location. Only administrators and the parties to a rescue see them."}
        {step === 0 && !isOrg && "We use your area and availability to show you pickups you can realistically make."}
        {step === 1 && "An administrator checks these against the details you entered. You can upload more later from Settings."}
      </p>
      {isOrg && <Steps steps={steps} current={step} />}

      {step === 0 && isOrg && (
        <OrgForm me={me} onDone={async () => { await refetch(); setStep(1); window.scrollTo({ top: 0 }); }} />
      )}
      {step === 0 && !isOrg && (
        <VolunteerForm me={me} onDone={async () => { await refetch(); notify("Profile saved. You can start accepting pickups."); router.replace("/dashboard/volunteer"); }} />
      )}
      {step === 1 && me.organization && (
        <div className="space-y-6">
          <DocumentUpload orgId={me.organization.id} required={REQUIRED_DOCS[me.role] ?? []} />
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setStep(2)}>Continue</Button>
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}>Back to details</Button>
          </div>
        </div>
      )}
      {step === 2 && me.organization && (
        <div className="space-y-6">
          <div className="flex items-start gap-4 rounded-md border border-line bg-surface p-5">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" aria-hidden />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{me.organization.name}</p>
                <VerificationBadge status={me.organization.verification_status} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {me.role === "RECIPIENT"
                  ? "Until you're verified you can browse your workspace and set up food requirements, but you can't claim donations."
                  : "Until you're verified you can prepare donation drafts, but you can't publish them."}{" "}
                We’ll notify you here when the review is complete.
              </p>
            </div>
          </div>
          <ButtonLink href={homeFor({ ...me, onboarding_completed: true })} size="lg">Go to your workspace</ButtonLink>
        </div>
      )}
    </>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Logo href="/dashboard" />
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-10">
        <Suspense><Onboarding /></Suspense>
      </main>
    </div>
  );
}
