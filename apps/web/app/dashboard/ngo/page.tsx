"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { StatStrip } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/feedback";
import { AvailableList } from "@/components/ngo/available-list";
import { Requirements } from "@/components/ngo/requirements";
import { IncomingDeliveries } from "@/components/ngo/claims-list";
import { formatNumber } from "@/lib/format";
import { useAvailableDonations, useClaims, useDemands, useOrgReport } from "@/lib/hooks";
import { useMeRequired } from "@/lib/use-me-required";

export default function NgoOverview() {
  const me = useMeRequired();
  const org = me.organization!;
  const available = useAvailableDonations();
  const claims = useClaims(org.id);
  const demands = useDemands(org.id);
  const month = useOrgReport(org.id, 1);
  const incoming = (claims.data ?? []).filter((d) => ["CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP"].includes(d.status)).length;
  const highPriority = (demands.data ?? []).filter((d) => d.priority === "high");

  return (
    <>
      <PageHeader title="Overview" description={org.name} />
      <div className="space-y-6">
        {available.isLoading || claims.isLoading ? <Skeleton className="h-24 w-full" /> : (
          <StatStrip items={[
            { label: "Available nearby", value: available.data?.donations.length ?? 0, note: "Open listings within 50 km" },
            { label: "Incoming", value: incoming, note: "Claimed, not yet delivered" },
            { label: "Received this month", value: <>{formatNumber(month.data?.quantity_rescued ?? 0)} <span className="text-base font-normal text-muted">{month.data?.primary_unit ?? "meals"}</span></>, note: "Confirmed deliveries" },
            { label: "Daily capacity", value: org.daily_capacity ? formatNumber(org.daily_capacity) : "—", note: "Meals per day" },
          ]} />
        )}
        {highPriority.length > 0 && (
          <div className="rounded-md border border-warning/30 bg-warning-50 px-5 py-3 text-sm">
            <span className="font-semibold">Shortages flagged: </span>
            {highPriority.map((d) => `${d.quantity_needed} ${d.unit} ${d.food_category.replace(/_/g, " ")}`).join(", ")}.{" "}
            <Link href="/dashboard/ngo/forecasting" className="font-semibold text-forest hover:underline">See supply against demand</Link>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-md font-semibold">Nearby donations</h2>
              <Link href="/dashboard/ngo/available" className="text-sm font-semibold text-forest hover:underline">See all and filter</Link>
            </div>
            <AvailableList me={me} limit={5} compact />
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-md font-semibold">Incoming pickups</h2>
              <IncomingDeliveries me={me} />
            </div>
            <Requirements me={me} compact />
          </div>
        </div>
      </div>
    </>
  );
}
