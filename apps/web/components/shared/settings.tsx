"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Store, Trash2 } from "lucide-react";
import { Panel, PanelBody, PanelHeader, KeyValue } from "@/components/ui/panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { VerificationBadge, Badge } from "@/components/ui/status";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CategoryPicker } from "./category-picker";
import { DocumentUpload } from "./document-upload";
import { PasswordStrength } from "./password-strength";
import { api, ApiError, errorMessage } from "@/lib/api";
import { categoryLabel } from "@/lib/places";
import { passwordChecks } from "@/lib/password";
import { useRefreshMe } from "@/lib/session";
import type { Branch, Me } from "@/lib/types";

export function ProfileSettings({ me }: { me: Me }) {
  const refresh = useRefreshMe();
  const { notify } = useToast();
  const [name, setName] = useState(me.full_name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.full_name = "Enter your full name.";
    if (phone && !/^\+?\d{10,13}$/.test(phone.replace(/[\s-]/g, ""))) errs.phone = "Enter a 10-digit mobile number.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api("/auth/me", { method: "PATCH", json: { full_name: name, phone: phone || null } });
      await refresh();
      notify("Profile updated");
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      notify(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Your profile" description="Used on handovers and notifications." />
      <form onSubmit={save} noValidate>
        <PanelBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" error={errors.full_name}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label="Mobile number" error={errors.phone} hint={
              me.phone_verification_available
                ? (me.phone_verified ? "Verified" : "Not verified yet")
                : "Phone verification isn't available yet: no SMS provider is configured."
            }>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </Field>
          </div>
          <KeyValue items={[
            { label: "Email", value: <span className="flex flex-wrap items-center gap-2">{me.email} {me.email_verified ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>}</span> },
          ]} />
          <Button type="submit" loading={saving}>Save profile</Button>
        </PanelBody>
      </form>
    </Panel>
  );
}

export function PasswordSettings() {
  const { notify } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.current = "Enter your current password.";
    if (!passwordChecks(next).every((c) => c.ok)) errs.next = "Choose a password that meets all three requirements.";
    setErr(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const fd = new URLSearchParams({ current_password: current, new_password: next });
      await api("/auth/change-password", { form: fd });
      notify("Password changed");
      setCurrent("");
      setNext("");
    } catch (e2) {
      setErr({ current: errorMessage(e2) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Panel>
      <PanelHeader title="Password" />
      <form onSubmit={save} noValidate>
        <PanelBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Current password" error={err.current}><PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
            <div className="space-y-2">
              <Field label="New password" error={err.next}><PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
              <PasswordStrength password={next} />
            </div>
          </div>
          <Button type="submit" variant="secondary" loading={saving}>Change password</Button>
        </PanelBody>
      </form>
    </Panel>
  );
}

const REQUIRED_DOCS: Record<string, string[]> = { DONOR: ["fssai_license"], RECIPIENT: ["ngo_registration"], CORPORATE: ["gst_certificate"] };

export function OrganizationSettings({ me }: { me: Me }) {
  const org = me.organization!;
  const p = org.profile as Record<string, unknown>;
  const refresh = useRefreshMe();
  const { notify } = useToast();
  const [hours, setHours] = useState((p.operating_hours as string) ?? "");
  const [cats, setCats] = useState<string[]>((p.food_categories as string[]) ?? []);
  const [capacity, setCapacity] = useState(org.daily_capacity ? String(org.daily_capacity) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (org.type === "DONOR") Object.assign(body, { operating_hours: hours, food_categories: cats });
      if (org.type === "RECIPIENT") Object.assign(body, { food_categories: cats, daily_capacity: Number(capacity) || 0 });
      await api(`/organizations/${org.id}/profile`, { method: "PATCH", json: body });
      await refresh();
      notify("Organisation settings saved");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Panel id="verification">
        <PanelHeader
          title="Verification"
          description="Administrators check your details and documents before you can publish or claim food."
          action={<ButtonLink href="/onboarding?edit=1" variant="secondary" size="sm">Edit registered details</ButtonLink>}
        />
        <PanelBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <VerificationBadge status={org.verification_status} />
            {org.verification_notes && <p className="text-sm text-ink-soft">Reviewer note: {org.verification_notes}</p>}
          </div>
          <KeyValue items={[
            { label: "Registered name", value: org.name },
            { label: "Address", value: org.address },
            ...(org.fssai_number ? [{ label: "FSSAI number", value: <span className="tabular">{org.fssai_number}</span> }] : []),
            ...(org.ngo_darpan_id ? [{ label: "Registration no.", value: org.ngo_darpan_id }] : []),
          ]} />
          <DocumentUpload orgId={org.id} required={REQUIRED_DOCS[org.type] ?? []} />
        </PanelBody>
      </Panel>
      {org.type !== "CORPORATE" && (
        <Panel>
          <PanelHeader title="Operations" />
          <PanelBody className="space-y-5">
            {org.type === "DONOR" && (
              <Field label="Operating hours" hint="When food can be collected."><Input value={hours} onChange={(e) => setHours(e.target.value)} className="max-w-sm" /></Field>
            )}
            {org.type === "RECIPIENT" && (
              <Field label="Daily meal capacity" hint="Claims that would take you above this in one day are declined."><Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="max-w-[10rem]" /></Field>
            )}
            <CategoryPicker legend={org.type === "DONOR" ? "Food you usually have" : "Food you accept"} value={cats} onChange={setCats} />
            <Button onClick={save} loading={saving}>Save changes</Button>
          </PanelBody>
        </Panel>
      )}
    </>
  );
}

export function SettingsView({ me }: { me: Me }) {
  return (
    <div className="space-y-6">
      <ProfileSettings me={me} />
      {me.organization && <OrganizationSettings me={me} />}
      <PasswordSettings />
    </div>
  );
}

export function BranchManager({ me }: { me: Me }) {
  const org = me.organization!;
  const branches: Branch[] = org.profile.branches ?? [];
  const refresh = useRefreshMe();
  const qc = useQueryClient();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", address: "", contact_phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function persist(next: Branch[], message: string) {
    setSaving(true);
    try {
      await api(`/organizations/${org.id}/profile`, { method: "PATCH", json: { branches: next } });
      await refresh();
      qc.invalidateQueries({ queryKey: ["me"] });
      notify(message);
      return true;
    } catch (e) {
      notify(errorMessage(e), "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name the branch.";
    if (form.address.trim().length < 5) e.address = "Enter the full address.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await persist([...branches, { name: form.name.trim(), address: form.address.trim(), contact_phone: form.contact_phone.trim() || null }], "Branch added");
    if (ok) { setAdding(false); setForm({ name: "", address: "", contact_phone: "" }); }
  }

  return (
    <Panel>
      <PanelHeader
        title="Branches"
        description={`Main address: ${org.address}`}
        action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add branch</Button>}
      />
      {!branches.length ? (
        <EmptyState icon={Store} title="No branches added">
          Add each outlet that has surplus to donate. You can then choose the branch when creating a listing.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {branches.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold">{b.name}</p>
                <p className="text-sm text-muted">{b.address}</p>
                {b.contact_phone && <p className="text-sm text-muted">{b.contact_phone}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(i)}><Trash2 className="h-4 w-4" aria-hidden /> Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a branch" footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={add} loading={saving}>Add branch</Button></>}>
        <div className="space-y-4">
          <Field label="Branch name" error={errors.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Benz Circle outlet" /></Field>
          <Field label="Address" error={errors.address}><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Contact phone" optional><Input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
          <Alert tone="info">Distances for listings from a branch are measured from your main address.</Alert>
        </div>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={async () => { if (removing === null) return; const ok = await persist(branches.filter((_, i) => i !== removing), "Branch removed"); if (ok) setRemoving(null); }}
        loading={saving}
        title="Remove this branch?"
        body={<>Existing listings from <strong>{removing !== null ? branches[removing]?.name : ""}</strong> are not affected.</>}
        confirmLabel="Remove branch"
        tone="danger"
      />
    </Panel>
  );
}

export function categoriesText(list?: string[]) {
  return list?.length ? list.map(categoryLabel).join(", ") : "—";
}
