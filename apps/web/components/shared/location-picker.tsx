"use client";

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AP_CITIES } from "@/lib/places";

export type LocationValue = { address: string; city: string; latitude: number | null; longitude: number | null; precise: boolean };

export function LocationPicker({
  value, onChange, errors = {}, addressLabel = "Street address",
}: { value: LocationValue; onChange: (v: LocationValue) => void; errors?: Record<string, string>; addressLabel?: string }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  function pickCity(name: string) {
    const c = AP_CITIES.find((x) => x.name === name);
    onChange({ ...value, city: name, ...(value.precise || !c ? {} : { latitude: c.lat, longitude: c.lng }) });
  }

  function useDevice() {
    if (!("geolocation" in navigator)) {
      setGeoError("This browser can't share a location. The city centre will be used.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ ...value, latitude: +pos.coords.latitude.toFixed(5), longitude: +pos.coords.longitude.toFixed(5), precise: true });
      },
      () => {
        setLocating(false);
        setGeoError("Location permission was denied. The city centre will be used instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-4">
      <Field label={addressLabel} error={errors.address} hint="Building, street and area. Volunteers use this to find you.">
        <Input value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} autoComplete="street-address" />
      </Field>
      <Field label="City" error={errors.city || errors.latitude}>
        <Select value={value.city} onChange={(e) => pickCity(e.target.value)}>
          <option value="">Select a city</option>
          {AP_CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </Select>
      </Field>
      <div className="flex flex-wrap items-center gap-3 rounded border border-dashed border-line-strong px-4 py-3 text-sm">
        <div className="flex-1">
          {value.precise ? (
            <p><span className="font-semibold">Exact location saved</span> <span className="text-muted tabular">({value.latitude}, {value.longitude})</span></p>
          ) : value.city ? (
            <p className="text-muted">Distances will be measured from the centre of {value.city}. Share your exact location for more accurate matching.</p>
          ) : (
            <p className="text-muted">Choose a city, or share your exact location.</p>
          )}
          {geoError && <p className="mt-1 text-warning-text">{geoError}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={useDevice} loading={locating}>
          <Crosshair className="h-4 w-4" aria-hidden /> Use my current location
        </Button>
      </div>
    </div>
  );
}

export const emptyLocation: LocationValue = { address: "", city: "", latitude: null, longitude: null, precise: false };
