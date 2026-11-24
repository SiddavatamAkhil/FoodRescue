"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Download } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { DonationStatusBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FilterTabs, Pagination, SearchInput, Table, TD, THead, TR } from "@/components/ui/table";
import { DonationDetailDialog } from "@/components/shared/donation-detail";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { downloadCsv, totalQuantity, useClaims } from "@/lib/hooks";
import type { Donation, Me } from "@/lib/types";

const IN_PROGRESS = ["CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP", "DELIVERED"];

export function ClaimsList({ me, mode }: { me: Me; mode: "requests" | "distribution" }) {
  const { data, isLoading, error, refetch } = useClaims(me.organization!.id);
  const [filter, setFilter] = useState<"all" | "progress" | "done" | "closed">(mode === "distribution" ? "done" : "all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Donation | null>(null);

  const rows = useMemo(() => {
    let r = data ?? [];
    if (mode === "distribution") r = r.filter((d) => d.status === "COMPLETED");
    else if (filter === "progress") r = r.filter((d) => IN_PROGRESS.includes(d.status));
    else if (filter === "done") r = r.filter((d) => d.status === "COMPLETED");
    else if (filter === "closed") r = r.filter((d) => ["FAILED", "EXPIRED", "CANCELLED", "DISPUTED"].includes(d.status));
    if (q.trim()) r = r.filter((d) => `${d.title} ${d.donor_name}`.toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [data, filter, q, mode]);
  const pageRows = rows.slice((page - 1) * 10, page * 10);

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        {mode === "requests" ? (
          <FilterTabs value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "progress", label: "In progress" }, { value: "done", label: "Received" }, { value: "closed", label: "Not completed" }]} />
        ) : <p className="text-sm text-muted">{rows.length} confirmed deliveries</p>}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search food or donor" label="Search" />
          {mode === "distribution" && (
            <Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`distribution-records-${new Date().toISOString().slice(0, 10)}.csv`, [
              ["Food", "Donor", "Quantity", "Unit", "Veg", "Delivered (UTC)"],
              ...rows.map((d) => { const t = totalQuantity(d); return [d.title, d.donor_name, t.qty, t.unit, d.food_items.every((i) => i.is_veg) ? "Yes" : "No", d.pickup?.delivered_at ?? d.updated_at]; }),
            ])}><Download className="h-4 w-4" aria-hidden /> Export</Button>
          )}
        </div>
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={ClipboardList} title={mode === "distribution" ? "No deliveries received yet" : "No claims yet"}>
          {mode === "distribution" ? "Each donation you receive and confirm with your delivery code is recorded here." : "Donations you claim from the Available donations page appear here."}
        </EmptyState>
      ) : (
        <>
          <Table>
            <THead columns={[{ label: "Food" }, { label: "Donor" }, { label: "Quantity", className: "text-right" }, { label: mode === "distribution" ? "Received" : "Status" }]} />
            <tbody>
              {pageRows.map((d) => {
                const t = totalQuantity(d);
                return (
                  <TR key={d.id} onClick={() => setSelected(d)}>
                    <TD label="Food"><span className="font-semibold">{d.title}</span></TD>
                    <TD label="Donor">{d.donor_name}</TD>
                    <TD label="Quantity" className="md:text-right"><span className="tabular">{t.qty} {t.unit}</span></TD>
                    <TD label={mode === "distribution" ? "Received" : "Status"}>
                      {mode === "distribution" ? <span className="tabular">{formatDateTime(d.pickup?.delivered_at ?? d.updated_at)}</span> : <DonationStatusBadge status={d.status} />}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={10} total={rows.length} onPage={setPage} />
        </>
      )}
      <DonationDetailDialog donation={selected} viewer="ngo" open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
}

export function IncomingDeliveries({ me }: { me: Me }) {
  const { data, isLoading, error, refetch } = useClaims(me.organization!.id);
  const [selected, setSelected] = useState<Donation | null>(null);
  const rows = (data ?? []).filter((d) => ["CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP"].includes(d.status));
  const label: Record<string, string> = { CLAIMED: "Waiting for a volunteer", PICKUP_ASSIGNED: "Volunteer heading to the donor", PICKED_UP: "On the way to you" };
  return (
    <Panel>
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={ClipboardList} title="Nothing on the way">Claimed donations show here until they arrive. Have your delivery code ready when the volunteer arrives.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((d) => {
            const t = totalQuantity(d);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{d.title}</p><DonationStatusBadge status={d.status} /></div>
                  <p className="text-sm text-muted tabular">{t.qty} {t.unit} from {d.donor_name} · {label[d.status]}</p>
                </div>
                <Button size="sm" variant={d.status === "PICKED_UP" ? "primary" : "secondary"} onClick={() => setSelected(d)}>
                  {d.status === "CLAIMED" ? "Details" : "Delivery code"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <DonationDetailDialog donation={selected} viewer="ngo" open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
}
