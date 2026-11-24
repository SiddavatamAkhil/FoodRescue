"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FilterTabs, Pagination, SearchInput, Table, TD, THead, TR } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { OrgReviewDialog } from "./org-review";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ORG_TYPE_LABEL, type AdminOrg } from "./types";
import type { Paged } from "@/lib/types";

const PAGE = 15;

export function OrgTable({ queue = false }: { queue?: boolean }) {
  const [status, setStatus] = useState(queue ? "PENDING" : "");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminOrg | null>(null);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String((page - 1) * PAGE) });
  if (status) params.set("status_filter", status);
  if (type) params.set("org_type", type);
  if (q.trim()) params.set("q", q.trim());
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-orgs", params.toString()], queryFn: () => api<Paged<AdminOrg>>(`/admin/organizations?${params}`) });

  const queueTabs = [
    { value: "PENDING", label: "New" }, { value: "UNDER_REVIEW", label: "Under review" }, { value: "INFO_REQUIRED", label: "Waiting on organisation" },
  ];
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        {queue ? (
          <FilterTabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={queueTabs} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-48 text-sm" aria-label="Verification status">
              <option value="">All statuses</option><option value="PENDING">Pending</option><option value="UNDER_REVIEW">Under review</option>
              <option value="INFO_REQUIRED">Information required</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option>
            </Select>
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-9 w-44 text-sm" aria-label="Organisation type">
              <option value="">All types</option><option value="DONOR">Food donors</option><option value="RECIPIENT">NGOs</option><option value="CORPORATE">Corporate</option>
            </Select>
          </div>
        )}
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name" label="Search organisations" />
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !data?.items.length ? (
        <EmptyState icon={queue ? ShieldCheck : Building} title={queue ? "Queue is clear" : "No organisations found"}>
          {queue ? "There are no organisations in this stage." : "Try a different filter."}
        </EmptyState>
      ) : (
        <>
          <Table>
            <THead columns={[{ label: "Organisation" }, { label: "Type" }, { label: "Documents" }, { label: "Status" }, { label: "Registered" }, { label: "Actions", srOnly: true }]} />
            <tbody>
              {data.items.map((o) => (
                <TR key={o.id}>
                  <TD label="Organisation"><span className="font-semibold">{o.name}</span>{o.is_demo && <span className="ml-2 text-xs text-muted">(demo)</span>}<p className="truncate text-xs text-muted">{o.address}</p></TD>
                  <TD label="Type">{ORG_TYPE_LABEL[o.type]}</TD>
                  <TD label="Documents"><span className={o.documents.length ? "" : "text-warning-text"}>{o.documents.length || "None"}</span></TD>
                  <TD label="Status"><VerificationBadge status={o.verification_status} /></TD>
                  <TD label="Registered"><span className="tabular">{formatDate(o.created_at)}</span></TD>
                  <TD label="Actions" className="md:text-right"><Button size="sm" variant={queue ? "primary" : "secondary"} onClick={() => setSelected(o)}>{queue ? "Review" : "Open"}</Button></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={data.total} onPage={setPage} />
        </>
      )}
      <OrgReviewDialog org={selected} open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
}
