"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, PackageOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelHeader, StatStrip } from "@/components/ui/panel";
import { ButtonLink, Button } from "@/components/ui/button";
import { DonationStatusBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows, Skeleton } from "@/components/ui/feedback";
import { DonationDetailDialog } from "./donation-detail";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatNumber, formatPercent, minutesUntil, relativeTime } from "@/lib/format";
import { totalQuantity, useOrgDonations, useOrgReport } from "@/lib/hooks";
import type { Donation, Me } from "@/lib/types";
import { cn } from "@/lib/cn";

const ACTIVE = ["PUBLISHED", "CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP"];
const PICKUP = ["CLAIMED", "PICKUP_ASSIGNED"];

/** Overview for organisations that give food (donors and corporates). */
export function DonorOverview({ me, base, title = "Overview", listPath = "donations", showPredictions = true }: { me: Me; base: string; title?: string; listPath?: string; showPredictions?: boolean }) {
  const org = me.organization!;
  const donations = useOrgDonations(org.id);
  const report = useOrgReport(org.id, 1);
  const [selected, setSelected] = useState<Donation | null>(null);
  const all = donations.data ?? [];
  const active = all.filter((d) => ACTIVE.includes(d.status)).sort((a, b) => a.pickup_deadline.localeCompare(b.pickup_deadline));
  const pickups = all.filter((d) => PICKUP.includes(d.status));
  const recent = all.filter((d) => ["COMPLETED", "EXPIRED", "CANCELLED", "FAILED"].includes(d.status)).slice(0, 5);
  const drafts = all.filter((d) => d.status === "DRAFT");
  const month = report.data;

  return (
    <>
      <PageHeader
        title={title}
        description={org.name}
        actions={<ButtonLink href={`${base}/donations/new`}><Plus className="h-4 w-4" aria-hidden /> Create donation</ButtonLink>}
      />
      <div className="space-y-6">
        {donations.isLoading || report.isLoading ? <Skeleton className="h-24 w-full" /> : (
          <StatStrip items={[
            { label: "Active listings", value: active.length, note: drafts.length ? `${drafts.length} draft${drafts.length > 1 ? "s" : ""} not published` : "Open or in progress" },
            { label: "Awaiting pickup", value: pickups.length, note: "Claimed, not yet collected" },
            { label: "Rescued this month", value: <>{formatNumber(month?.quantity_rescued ?? 0)} <span className="text-base font-normal text-muted">{month?.primary_unit ?? "meals"}</span></>, note: "Delivery confirmed" },
            { label: "Completion rate", value: formatPercent(month?.completion_rate ?? null), note: "This month, closed listings" },
          ]} />
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <PanelHeader title="Active donations" description="Soonest deadline first." action={<Link href={`${base}/${listPath}`} className="text-sm font-semibold text-forest hover:underline">All donations</Link>} />
            {donations.isLoading ? <LoadingRows /> : donations.error ? <ErrorState message={errorMessage(donations.error)} onRetry={donations.refetch} /> : !active.length ? (
              <EmptyState icon={PackageOpen} title="Nothing active right now" action={<ButtonLink href={`${base}/donations/new`} variant="secondary">Create a donation</ButtonLink>}>
                When you have surplus, list it here. Nearby NGOs are shown it straight away.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {active.map((d) => {
                  const mins = minutesUntil(d.pickup_deadline) ?? 0;
                  const t = totalQuantity(d);
                  return (
                    <li key={d.id}>
                      <button type="button" onClick={() => setSelected(d)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-canvas/70">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{d.title}</p>
                          <p className="text-sm text-muted tabular">{t.qty} {t.unit} · collect by {formatDateTime(d.pickup_deadline)}</p>
                        </div>
                        <span className={cn("text-sm font-semibold tabular", mins < 60 && d.status === "PUBLISHED" ? "text-danger-text" : "text-muted")}>{relativeTime(d.pickup_deadline)}</span>
                        <DonationStatusBadge status={d.status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel>
              <PanelHeader title="Pending pickups" description="Have the pickup code ready when the volunteer arrives." />
              {!pickups.length ? (
                <p className="px-5 py-6 text-sm text-muted">No pickups waiting. Claimed donations appear here with their pickup code.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {pickups.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{d.title}</p>
                        <p className="text-xs text-muted">{d.status === "CLAIMED" ? "Waiting for a volunteer" : "Volunteer on the way"}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setSelected(d)}>{d.status === "CLAIMED" ? "Details" : "Pickup code"}</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="Recent outcomes" />
              {!recent.length ? (
                <p className="px-5 py-6 text-sm text-muted">Completed and closed listings will be summarised here.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recent.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <button type="button" onClick={() => setSelected(d)} className="min-w-0 truncate text-left text-sm font-semibold hover:underline">{d.title}</button>
                      <DonationStatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            {showPredictions && <Link href={`${base}/predictions`} className="flex items-center justify-between rounded-md border border-line bg-surface px-5 py-4 text-sm hover:border-forest">
              <span><span className="block font-semibold">Surplus predictions</span><span className="text-muted">Expected surplus by day, from your history</span></span>
              <ArrowRight className="h-4 w-4 text-forest" aria-hidden />
            </Link>}
          </div>
        </div>
      </div>
      <DonationDetailDialog donation={selected} viewer="donor" open={!!selected} onClose={() => setSelected(null)} />
    </>
  );
}
