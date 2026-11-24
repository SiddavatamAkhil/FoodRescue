"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { toLocalInputValue } from "@/lib/format";
import { useAiStatus } from "@/lib/hooks";
import type { Donation, Me } from "@/lib/types";

type Item = { name: string; quantity: string; unit: string; veg: "veg" | "nonveg"; prep: string; expiry: string };

const hoursFromNow = (h: number) => toLocalInputValue(new Date(Date.now() + h * 3600_000));
const blankItem = (): Item => ({ name: "", quantity: "", unit: "meals", veg: "veg", prep: hoursFromNow(-1), expiry: hoursFromNow(5) });

const UNITS = [["meals", "Meals"], ["kg", "Kilograms"], ["boxes", "Boxes"], ["trays", "Trays"], ["packets", "Packets"], ["litres", "Litres"]];

export function DonationForm({ me, listHref }: { me: Me; listHref: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { notify } = useToast();
  const org = me.organization!;
  const verified = org.verification_status === "VERIFIED";
  const branches = org.profile.branches ?? [];
  const ai = useAiStatus();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("main");
  const [address, setAddress] = useState(org.address);
  const [deadline, setDeadline] = useState(hoursFromNow(3));
  const [storage, setStorage] = useState("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [unserved, setUnserved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  const setItem = (i: number, patch: Partial<Item>) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  function chooseLocation(v: string) {
    setLocation(v);
    if (v === "main") setAddress(org.address);
    else {
      const b = branches[Number(v)];
      if (b) setAddress(`${b.name}, ${b.address}`);
    }
  }

  async function runAssistant() {
    if (aiText.trim().length < 5) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const r = await api<{ name: string; quantity: number; unit: string; is_veg: boolean }>("/ai/parse-listing", { json: { text: aiText } });
      setItems((arr) => {
        const filled = { ...blankItem(), name: r.name, quantity: String(r.quantity), unit: UNITS.some(([u]) => u === r.unit) ? r.unit : "meals", veg: r.is_veg ? "veg" : "nonveg" } as Item;
        return arr.length === 1 && !arr[0].name ? [filled] : [...arr, filled];
      });
      if (!title) setTitle(r.name);
      setAiMsg({ tone: "success", text: "Added to the items below. Check the quantity and times before publishing." });
    } catch (e) {
      setAiMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setAiBusy(false);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = "Give the listing a short title, e.g. \"Veg biryani, 40 portions\".";
    if (address.trim().length < 5) e.address = "Enter where the food should be collected.";
    const dl = new Date(deadline).getTime();
    if (!deadline || Number.isNaN(dl)) e.deadline = "Choose a pickup deadline.";
    else if (dl <= Date.now() + 15 * 60_000) e.deadline = "Set the deadline at least 15 minutes from now.";
    items.forEach((it, i) => {
      if (!it.name.trim()) e[`items.${i}.name`] = "Name the item.";
      if (!(Number(it.quantity) > 0)) e[`items.${i}.quantity`] = "Enter a quantity.";
      if (new Date(it.expiry).getTime() <= new Date(it.prep).getTime()) e[`items.${i}.expiry`] = "Must be after the preparation time.";
      else if (deadline && new Date(it.expiry).getTime() < dl) e[`items.${i}.expiry`] = "Food would expire before the pickup deadline.";
    });
    if (!unserved) e.unserved = "Confirm the food has not been served. Plate leftovers can't be donated.";
    return e;
  }

  async function submit(mode: "draft" | "publish") {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setError("Some details need attention.");
      return;
    }
    setSaving(mode);
    setError("");
    try {
      const branchCoords = { latitude: org.latitude, longitude: org.longitude };
      const created = await api<Donation>(`/donations/?org_id=${org.id}`, {
        json: {
          title: title.trim(),
          description: description.trim() || null,
          pickup_address: address.trim(),
          pickup_deadline: new Date(deadline).toISOString(),
          storage_info: storage.trim() || null,
          ...branchCoords,
          food_items: items.map((it) => ({
            name: it.name.trim(),
            quantity: Number(it.quantity),
            unit: it.unit,
            is_veg: it.veg === "veg",
            prep_time: new Date(it.prep).toISOString(),
            expiry_time: new Date(it.expiry).toISOString(),
            is_leftover: false,
          })),
        },
      });
      if (mode === "publish") {
        await api(`/donations/${created.id}/transition`, { json: { status: "PUBLISHED" } });
        notify("Donation published. Nearby verified NGOs can now claim it.");
      } else {
        notify("Draft saved.");
      }
      qc.invalidateQueries({ queryKey: ["donations"] });
      qc.invalidateQueries({ queryKey: ["report"] });
      router.push(listHref);
    } catch (err) {
      if (err instanceof ApiError) {
        const f: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) {
          const m = k.match(/^food_items\.(\d+)\.(\w+)/);
          if (m) f[`items.${m[1]}.${m[2] === "quantity" ? "quantity" : m[2] === "name" ? "name" : "expiry"}`] = v;
          else if (k === "pickup_deadline") f.deadline = v;
          else f[k] = v;
        }
        setErrors(f);
      }
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={(e) => { e.preventDefault(); submit(verified ? "publish" : "draft"); }} noValidate className="space-y-6">
        {error && <Alert tone="danger">{error}</Alert>}
        {!verified && (
          <Alert tone="warning" title="You can save drafts until you're verified">
            Publishing unlocks once an administrator verifies {org.name}.
          </Alert>
        )}

        <Panel>
          <PanelHeader title="Listing" />
          <PanelBody className="space-y-5">
            <Field label="Title" error={errors.title} hint="What NGOs see first in the list.">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Veg biryani and raita, 40 portions" />
            </Field>
            <Field label="Notes for the NGO" optional>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Allergens, packaging, who to ask for at the counter" />
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Items" description="Add each dish or product separately." action={
            <Button variant="secondary" size="sm" onClick={() => setItems((a) => [...a, blankItem()])}><Plus className="h-4 w-4" aria-hidden /> Add item</Button>
          } />
          <ul className="divide-y divide-line">
            {items.map((it, i) => (
              <li key={i} className="space-y-4 px-5 py-5">
                <div className="flex items-start gap-4">
                  <Field label={`Item ${i + 1}`} error={errors[`items.${i}.name`]} className="flex-1">
                    <Input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="e.g. Veg biryani" />
                  </Field>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} className="mt-7 rounded p-2 text-muted hover:bg-danger-50 hover:text-danger" aria-label={`Remove item ${i + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-[8rem_10rem_1fr]">
                  <Field label="Quantity" error={errors[`items.${i}.quantity`]}>
                    <Input type="number" min={0} step="any" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Unit">
                    <Select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })}>
                      {UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  </Field>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">Type</p>
                    <Segmented label={`Item ${i + 1} type`} value={it.veg} onChange={(v) => setItem(i, { veg: v })} options={[{ value: "veg", label: "Veg" }, { value: "nonveg", label: "Non-veg" }]} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prepared at"><Input type="datetime-local" value={it.prep} onChange={(e) => setItem(i, { prep: e.target.value })} /></Field>
                  <Field label="Safe to eat until" error={errors[`items.${i}.expiry`]}><Input type="datetime-local" value={it.expiry} onChange={(e) => setItem(i, { expiry: e.target.value })} /></Field>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Pickup" />
          <PanelBody className="space-y-5">
            {branches.length > 0 && (
              <Field label="Location">
                <Select value={location} onChange={(e) => chooseLocation(e.target.value)}>
                  <option value="main">Main address</option>
                  {branches.map((b, i) => <option key={i} value={String(i)}>{b.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Pickup address" error={errors.address}>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collect by" error={errors.deadline} hint="After this time the listing closes automatically.">
                <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </Field>
              <Field label="Storage until pickup" optional>
                <Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="e.g. Hot holding at 65°C" />
              </Field>
            </div>
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <div>
            <Checkbox checked={unserved} onChange={(e) => setUnserved(e.target.checked)} label="This food has not been served to anyone, and has been stored safely since it was prepared." />
            {errors.unserved && <p className="mt-1 text-sm font-medium text-danger-text">{errors.unserved}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {verified && <Button type="submit" size="lg" loading={saving === "publish"} disabled={!!saving}>Publish donation</Button>}
            <Button variant={verified ? "secondary" : "primary"} size="lg" onClick={() => submit("draft")} loading={saving === "draft"} disabled={!!saving}>Save as draft</Button>
          </div>
        </div>
      </form>

      <aside className="space-y-4">
        <Panel>
          <PanelHeader title="Describe it instead" />
          <PanelBody className="space-y-3">
            {ai.data?.listing_assistant ? (
              <>
                <p className="text-sm text-muted">Write a sentence about the surplus and the listing assistant adds it as an item. It refuses anything that sounds like plate leftovers.</p>
                <Textarea rows={3} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="About 40 boxes of veg biryani, cooked at 1 pm, never served" aria-label="Describe the surplus" />
                <Button variant="secondary" size="sm" onClick={runAssistant} loading={aiBusy} disabled={aiText.trim().length < 5}>
                  <Sparkles className="h-4 w-4" aria-hidden /> Fill in from description
                </Button>
                {aiMsg && <Alert tone={aiMsg.tone}>{aiMsg.text}</Alert>}
              </>
            ) : (
              <p className="text-sm text-muted">
                The listing assistant isn’t available on this server because no language model is configured. Fill in the form directly.
              </p>
            )}
          </PanelBody>
        </Panel>
        <div className="rounded-md border border-line bg-surface p-5 text-sm">
          <p className="font-semibold">Accepted</p>
          <p className="mt-1 text-muted">Unserved cooked food, bakery, dry rations, fruit and vegetables, dairy and packaged food within date.</p>
          <p className="mt-3 font-semibold">Not accepted</p>
          <p className="mt-1 text-muted">Plate leftovers, food from self-service buffets after guests have served themselves, or anything past its safe time.</p>
        </div>
      </aside>
    </div>
  );
}
