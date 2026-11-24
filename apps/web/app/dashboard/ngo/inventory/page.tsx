"use client";

import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Table, TD, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { formatDateTime, minutesUntil, relativeTime } from "@/lib/format";
import { useClaims } from "@/lib/hooks";
import { useMeRequired } from "@/lib/use-me-required";

export default function NgoInventoryPage() {
  const me = useMeRequired();
  const { data, isLoading, error, refetch } = useClaims(me.organization!.id);
  const items = (data ?? [])
    .filter((d) => d.status === "COMPLETED")
    .flatMap((d) => d.food_items.map((i) => ({ ...i, donor: d.donor_name, received: d.pickup?.delivered_at ?? d.updated_at })))
    .filter((i) => (minutesUntil(i.expiry_time) ?? -1) > -24 * 60)
    .sort((a, b) => a.expiry_time.localeCompare(b.expiry_time));

  return (
    <>
      <PageHeader title="Inventory" description="Food received in the last day, ordered by safe-to-eat time. Serve or distribute the earliest first." />
      <Panel>
        {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !items.length ? (
          <EmptyState icon={Boxes} title="No recent food on hand">Items from deliveries you’ve confirmed appear here until a day after their safe time.</EmptyState>
        ) : (
          <Table>
            <THead columns={[{ label: "Item" }, { label: "Quantity", className: "text-right" }, { label: "Safe until" }, { label: "From" }, { label: "Received" }]} />
            <tbody>
              {items.map((i) => {
                const mins = minutesUntil(i.expiry_time) ?? 0;
                return (
                  <TR key={i.id}>
                    <TD label="Item"><span className="font-semibold">{i.name}</span> <span className="text-xs text-muted">{i.is_veg ? "Veg" : "Non-veg"}</span></TD>
                    <TD label="Quantity" className="md:text-right"><span className="tabular">{i.quantity} {i.unit}</span></TD>
                    <TD label="Safe until">
                      <span className="tabular">{formatDateTime(i.expiry_time)}</span>{" "}
                      {mins < 0 ? <Badge tone="danger">Do not serve</Badge> : mins < 120 ? <Badge tone="warning">{relativeTime(i.expiry_time)}</Badge> : null}
                    </TD>
                    <TD label="From">{i.donor}</TD>
                    <TD label="Received"><span className="tabular">{formatDateTime(i.received)}</span></TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
