"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, PackageOpen } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { Alert, EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FilterTabs, SearchInput } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, minutesUntil, relativeTime } from "@/lib/format";
import { totalQuantity, useAvailableDonations } from "@/lib/hooks";
import type { Donation, Me } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Why this listing is shown, from the same factors the matching engine uses. */
function reasons(d: Donation, me: Me): string[] {
  const r: string[] = [];
  if (d.distance_km !== undefined) r.push(`${d.distance_km} km away`);
  const mins = minutesUntil(d.pickup_deadline) ?? 0;
  r.push(mins < 120 ? "Urgent: under 2 hours left" : `${Math.floor(mins / 60)} h until deadline`);
  const accepts = (me.organization?.profile.food_categories ?? []) as string[];
  const allVeg = d.food_items.every((i) => i.is_veg);
  if (allVeg && accepts.includes("cooked_veg")) r.push("Matches your veg category");
  if (!allVeg && accepts.includes("cooked_non_veg")) r.push("Matches your non-veg category");
  const cap = me.organization?.daily_capacity;
  const { qty, unit } = totalQuantity(d);
  if (cap && unit === "meals") r.push(qty <= cap ? `Within your ${cap}-meal daily capacity` : `More than your ${cap}-meal daily capacity`);
  return r;
}

export function AvailableList({ me, limit, compact = false }: { me: Me; limit?: number; compact?: boolean }) {
  const { data, isLoading, error, refetch } = useAvailableDonations();
  const qc = useQueryClient();
  const { notify } = useToast();
  const [type, setType] = useState<"all" | "veg" | "nonveg">("all");
  const [radius, setRadius] = useState("50");
  const [q, setQ] = useState("");
  const [claiming, setClaiming] = useState<Donation | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = me.organization?.verification_status === "VERIFIED";

  const rows = useMemo(() => {
    let r = data?.donations ?? [];
    if (type === "veg") r = r.filter((d) => d.food_items.every((i) => i.is_veg));
    if (type === "nonveg") r = r.filter((d) => d.food_items.some((i) => !i.is_veg));
    r = r.filter((d) => (d.distance_km ?? 0) <= Number(radius));
    if (q.trim()) r = r.filter((d) => `${d.title} ${d.donor_name} ${d.pickup_address}`.toLowerCase().includes(q.toLowerCase()));
    return limit ? r.slice(0, limit) : r;
  }, [data, type, radius, q, limit]);

  async function claim() {
    if (!claiming) return;
    setBusy(true);
    try {
      await api(`/claims/donation/${claiming.id}?org_id=${me.organization!.id}`, { method: "POST" });
      notify(`Claimed "${claiming.title}". A volunteer will be matched for pickup.`);
      setClaiming(null);
      qc.invalidateQueries({ queryKey: ["available"] });
      qc.invalidateQueries({ queryKey: ["claims"] });
    } catch (e) {
      notify(errorMessage(e), "error");
      qc.invalidateQueries({ queryKey: ["available"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <FilterTabs value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "veg", label: "Veg only" }, { value: "nonveg", label: "Includes non-veg" }]} />
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SearchInput value={q} onChange={setQ} placeholder="Search food or donor" label="Search available donations" />
            <Select value={radius} onChange={(e) => setRadius(e.target.value)} className="h-9 w-32 text-sm" aria-label="Distance">
              <option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option><option value="50">Within 50 km</option>
            </Select>
          </div>
        </div>
      )}
      {!verified && !compact && (
        <div className="border-b border-line px-5 py-3"><Alert tone="warning">You can browse donations now. Claiming unlocks once your organisation is verified.</Alert></div>
      )}
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={PackageOpen} title={data?.donations.length ? "Nothing matches these filters" : "No donations available nearby right now"}>
          {data?.donations.length ? "Widen the distance or clear the search." : "New listings within 50 km appear here as soon as donors publish them. This page refreshes every minute."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((d) => {
            const t = totalQuantity(d);
            const mins = minutesUntil(d.pickup_deadline) ?? 0;
            return (
              <li key={d.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{d.title}</p>
                    <Badge tone={d.food_items.every((i) => i.is_veg) ? "success" : "neutral"}>{d.food_items.every((i) => i.is_veg) ? "Veg" : "Non-veg"}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft"><span className="font-semibold tabular">{t.qty} {t.unit}</span> from {d.donor_name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{d.pickup_address}</span>
                    <span className={cn("inline-flex items-center gap-1 tabular", mins < 120 && "font-semibold text-danger-text")}><Clock className="h-3.5 w-3.5" aria-hidden />Collect by {formatDateTime(d.pickup_deadline)} ({relativeTime(d.pickup_deadline)})</span>
                  </div>
                  {!compact && <p className="mt-2 text-xs text-muted">Shown because: {reasons(d, me).join(" · ")}</p>}
                </div>
                <Button onClick={() => setClaiming(d)} disabled={!verified} title={verified ? undefined : "Available once your organisation is verified"}>Claim</Button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!claiming}
        onClose={() => setClaiming(null)}
        onConfirm={claim}
        loading={busy}
        title="Claim this donation?"
        body={claiming && <>You’re committing to receive <strong>{totalQuantity(claiming).qty} {totalQuantity(claiming).unit}</strong> of <strong>{claiming.title}</strong> before {formatDateTime(claiming.pickup_deadline)}. Only claim food you can serve safely.</>}
        confirmLabel="Claim donation"
      />
    </Panel>
  );
}
