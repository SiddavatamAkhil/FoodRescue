"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { DonationStatusBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Pagination, SearchInput, Table, TD, THead, TR } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { AdminDonation } from "./types";
import type { DonationStatus, Paged } from "@/lib/types";

export function AdminDonationTable({ fixedStatus, title, emptyText, pageSize = 15 }: { fixedStatus?: DonationStatus; title?: string; emptyText?: string; pageSize?: number }) {
  const [status, setStatus] = useState<string>(fixedStatus ?? "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
  if (status) params.set("status_filter", status);
  if (q.trim()) params.set("q", q.trim());
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-donations", params.toString()], queryFn: () => api<Paged<AdminDonation>>(`/admin/donations?${params}`), refetchInterval: 60_000 });

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        {title ? <p className="text-md font-semibold">{title}</p> : (
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-48 text-sm" aria-label="Status">
            <option value="">All statuses</option>
            {["DRAFT", "PUBLISHED", "CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP", "COMPLETED", "EXPIRED", "CANCELLED", "FAILED", "DISPUTED"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}</option>)}
          </Select>
        )}
        {!title && <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by title" label="Search donations" />}
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !data?.items.length ? (
        <EmptyState icon={ClipboardList} title={emptyText ?? "No donations found"} />
      ) : (
        <>
          <Table>
            <THead columns={[{ label: "Donation" }, { label: "Donor" }, { label: "Quantity", className: "text-right" }, { label: "Deadline" }, { label: "Status" }]} />
            <tbody>
              {data.items.map((d) => (
                <TR key={d.id}>
                  <TD label="Donation"><span className="font-semibold">{d.title}</span>{d.is_demo && <span className="ml-2 text-xs text-muted">(demo)</span>}<p className="truncate text-xs text-muted">{d.pickup_address}</p></TD>
                  <TD label="Donor">{d.donor_name}</TD>
                  <TD label="Quantity" className="md:text-right"><span className="tabular">{d.quantity} {d.unit ?? ""}</span></TD>
                  <TD label="Deadline"><span className="tabular">{formatDateTime(d.pickup_deadline)}</span><p className="text-xs text-muted">{relativeTime(d.pickup_deadline)}</p></TD>
                  <TD label="Status"><DonationStatusBadge status={d.status as DonationStatus} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
