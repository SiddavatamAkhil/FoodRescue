"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { LocationPicker, emptyLocation, type LocationValue } from "@/components/shared/location-picker";
import { api, ApiError, errorMessage } from "@/lib/api";
import { AP_CITIES } from "@/lib/places";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/cn";

function splitArea(area: string, latitude: number | null, longitude: number | null): LocationValue {
  const city = AP_CITIES.find((c) => area.toLowerCase().includes(c.name.toLowerCase()))?.name ?? "";
  const address = city ? area.replace(new RegExp(`,?\\s*${city}$`, "i"), "").trim() : area;
  return { address: address === city ? "" : address, city, latitude, longitude, precise: latitude !== null };
}

const phoneOk = (p: string) => /^\+?\d{10,13}$/.test(p.replace(/[\s-]/g, ""));

const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];

export function VolunteerForm({ me, onDone, submitLabel = "Finish setup" }: { me: Me; onDone: () => void; submitLabel?: string }) {
  const v = me.volunteer;
  const [phone, setPhone] = useState(me.phone ?? "");
  const [loc, setLoc] = useState<LocationValue>(
    v ? splitArea(v.service_area ?? "", v.latitude ?? null, v.longitude ?? null) : emptyLocation,
  );
  const [days, setDays] = useState<string[]>(v?.availability.days ?? []);
  const [from, setFrom] = useState(v?.availability.from ?? "09:00");
  const [to, setTo] = useState(v?.availability.to ?? "18:00");
  const [vehicle, setVehicle] = useState(v?.vehicle_type ?? "two_wheeler");
  const [capacity, setCapacity] = useState(v?.vehicle_capacity ? String(v.vehicle_capacity) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!phoneOk(phone)) e.contact_phone = "Enter a 10-digit mobile number.";
    if (!loc.city) e.city = "Choose the city you'll cover.";
    if (!days.length) e.available_days = "Choose at least one day.";
    if (from >= to) e.available_to = "End time must be after start time.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setError("");
    try {
      await api("/auth/onboarding", {
        json: {
          contact_phone: phone,
          service_area: loc.address.trim() ? `${loc.address.trim()}, ${loc.city}` : loc.city,
          latitude: loc.latitude,
          longitude: loc.longitude,
          available_days: days,
          available_from: from,
          available_to: to,
          vehicle_type: vehicle,
          vehicle_capacity_kg: vehicle === "none" || !capacity ? null : Number(capacity),
        },
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {error && <Alert tone="danger">{error}</Alert>}
      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Contact</h2>
        <Field label="Mobile number" error={errors.contact_phone} hint="Donors and NGOs may call this number during a pickup.">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="max-w-xs" />
        </Field>
      </section>
      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Service area</h2>
        <LocationPicker value={loc} onChange={setLoc} errors={{ city: errors.city }} addressLabel="Area or neighbourhood" />
      </section>
      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Availability</h2>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Days you can usually help</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(([k, label]) => {
              const on = days.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((d) => d !== k) : [...days, k])}
                  className={cn("h-9 w-14 rounded border text-sm font-semibold", on ? "border-forest bg-forest-50 text-forest" : "border-line-strong bg-surface text-muted hover:text-ink")}>
                  {label}
                </button>
              );
            })}
          </div>
          {errors.available_days && <p className="mt-1.5 text-sm font-medium text-danger-text">{errors.available_days}</p>}
        </fieldset>
        <div className="grid max-w-sm grid-cols-2 gap-4">
          <Field label="From"><Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" error={errors.available_to}><Input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </section>
      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Vehicle</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Vehicle type">
            <Select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              <option value="none">No vehicle (on foot)</option>
              <option value="bicycle">Bicycle</option>
              <option value="two_wheeler">Two-wheeler</option>
              <option value="auto">Auto-rickshaw</option>
              <option value="car">Car</option>
              <option value="van">Van or small truck</option>
            </Select>
          </Field>
          {vehicle !== "none" && (
            <Field label="Carrying capacity (kg)" optional error={errors.vehicle_capacity_kg}>
              <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </Field>
          )}
        </div>
      </section>
      <div className="border-t border-line pt-6">
        <Button type="submit" size="lg" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
