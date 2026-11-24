"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { DonationStatusBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { CustodyChain } from "./custody-chain";
import { DonationDetailDialog, donationTimeline } from "./donation-detail";
import { errorMessage } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { totalQuantity, useOrgDonations } from "@/lib/hooks";
import type { Donation, Me } from "@/lib/types";

export function PickupTracking({ me }: { me: Me }) {
  const { data, isLoading, error, refetch } = useOrgDonations(me.organization!.id);
  const [selected, setSelected] = useState<Donation | null>(null);
  const rows = (data ?? []).filter((d) => ["CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP"].includes(d.status));
  const recent = (data ?? []).filter((d) => d.status === "COMPLETED").slice(0, 5);

  if (isLoading) return <Panel><LoadingRows /></Panel>;
  if (error) return <Panel><ErrorState message={errorMessage(error)} onRetry={refetch} /></Panel>;
  return (
    <div className="space-y-6">
      {!rows.length ? (
        <Panel>
          <EmptyState icon={Truck} title="No pickups in progress">Once an NGO claims one of your donations, you can follow the pickup here and get the code to hand over.</EmptyState>
        </Panel>
      ) : (
        rows.map((d) => {
          const t = totalQuantity(d);
          return (
            <Panel key={d.id} className="grid gap-6 p-5 md:grid-cols-[1fr_1.1fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="text-md font-semibold">{d.title}</p><DonationStatusBadge status={d.status} /></div>
                <p className="mt-1 text-sm text-muted tabular">{t.qty} {t.unit} · collect by {formatDateTime(d.pickup_deadline)} ({relativeTime(d.pickup_deadline)})</p>
                <p className="mt-1 text-sm text-muted">{d.pickup_address}</p>
                <Button className="mt-4" size="sm" onClick={() => setSelected(d)}>{d.status === "PICKUP_ASSIGNED" ? "Show pickup code" : "View details"}</Button>
              </div>
              <CustodyChain compact steps={donationTimeline(d)} />
            </Panel>
          );
        })
      )}
      {recent.length > 0 && (
        <Panel>
          <div className="border-b border-line px-5 py-3 text-sm font-semibold">Recently delivered</div>
          <ul className="divide-y divide-line">
            {recent.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <button type="button" className="font-semibold hover:underline" onClick={() => setSelected(d)}>{d.title}</button>
                <span className="text-muted">{formatDateTime(d.updated_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <DonationDetailDialog donation={selected} viewer="donor" open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
