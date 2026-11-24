"use client";

import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Badge, DonationStatusBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Table, TD, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { formatDateTime, minutesUntil, relativeTime } from "@/lib/format";
import { useOrgDonations } from "@/lib/hooks";
import { useMeRequired } from "@/lib/use-me-required";

export default function InventoryPage() {
  const me = useMeRequired();
  const { data, isLoading, error, refetch } = useOrgDonations(me.organization!.id);
  const items = (data ?? [])
    .filter((d) => ["DRAFT", "PUBLISHED", "CLAIMED", "PICKUP_ASSIGNED"].includes(d.status))
    .flatMap((d) => d.food_items.map((i) => ({ ...i, donation: d })))
    .sort((a, b) => a.expiry_time.localeCompare(b.expiry_time));
  const totalByUnit = items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.unit]: (acc[i.unit] ?? 0) + i.quantity }), {});

  return (
    <>
      <PageHeader title="Food inventory" description="Surplus you've recorded that is still on your premises, soonest expiry first." />
      <Panel>
        {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !items.length ? (
          <EmptyState icon={Boxes} title="No surplus on hand">Items from drafts, open listings and claimed donations awaiting collection show up here.</EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line px-5 py-3 text-sm">
              <span className="text-muted">On hand:</span>
              {Object.entries(totalByUnit).map(([u, q]) => <span key={u} className="font-semibold tabular">{q} {u}</span>)}
            </div>
            <Table>
              <THead columns={[{ label: "Item" }, { label: "Quantity", className: "text-right" }, { label: "Safe until" }, { label: "Listing" }]} />
              <tbody>
                {items.map((i) => {
                  const mins = minutesUntil(i.expiry_time) ?? 0;
                  return (
                    <TR key={i.id}>
                      <TD label="Item"><span className="font-semibold">{i.name}</span> <span className="text-xs text-muted">{i.is_veg ? "Veg" : "Non-veg"}</span></TD>
                      <TD label="Quantity" className="md:text-right"><span className="tabular">{i.quantity} {i.unit}</span></TD>
                      <TD label="Safe until">
                        <span className="tabular">{formatDateTime(i.expiry_time)}</span>{" "}
                        {mins < 0 ? <Badge tone="danger">Past safe time</Badge> : mins < 120 ? <Badge tone="warning">{relativeTime(i.expiry_time)}</Badge> : <span className="text-xs text-muted">{relativeTime(i.expiry_time)}</span>}
                      </TD>
                      <TD label="Listing"><span className="mr-2 text-sm">{i.donation.title}</span><DonationStatusBadge status={i.donation.status} /></TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </Panel>
    </>
  );
}
