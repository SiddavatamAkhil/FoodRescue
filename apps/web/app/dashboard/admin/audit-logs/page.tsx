"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Pagination, Table, TD, THead, TR } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Paged } from "@/lib/types";

type Log = { id: string; action: string; resource: string; timestamp: string; actor_email?: string | null; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; ip_address?: string | null };
const ACTIONS = ["REGISTER_USER", "COMPLETE_ONBOARDING", "VERIFY_ORGANIZATION", "UPLOAD_DOCUMENT", "CREATE_DONATION", "TRANSITION_DONATION", "CLAIM_DONATION", "ASSIGN_PICKUP", "CUSTODY_HANDOFF", "CUSTODY_DELIVERY", "REPORT_INCIDENT", "UPDATE_INCIDENT", "DEACTIVATE_USER", "ACTIVATE_USER", "RESET_PASSWORD"];
const PAGE = 25;

function summary(v?: Record<string, unknown> | null) {
  if (!v) return "";
  return Object.entries(v).filter(([k]) => !["id"].includes(k)).map(([k, val]) => `${k}: ${typeof val === "object" ? JSON.stringify(val) : val}`).join(", ");
}

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String((page - 1) * PAGE) });
  if (action) params.set("action", action);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["audit", params.toString()], queryFn: () => api<Paged<Log>>(`/admin/audit-logs?${params}`) });
  return (
    <>
      <PageHeader title="Audit logs" description="Every state change and security-relevant action, newest first. Records can't be edited." />
      <Panel>
        <div className="border-b border-line px-5 py-3">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="h-9 w-64 text-sm" aria-label="Action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.toLowerCase().replace(/_/g, " ")}</option>)}
          </Select>
        </div>
        {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState icon={FileSearch} title="No entries" />
        ) : (
          <>
            <Table>
              <THead columns={[{ label: "Time" }, { label: "Action" }, { label: "Actor" }, { label: "Change" }]} />
              <tbody>
                {data.items.map((l) => (
                  <TR key={l.id}>
                    <TD label="Time"><span className="whitespace-nowrap tabular">{formatDateTime(l.timestamp)}</span></TD>
                    <TD label="Action"><span className="font-semibold">{l.action.toLowerCase().replace(/_/g, " ")}</span><p className="text-xs text-muted">{l.resource}</p></TD>
                    <TD label="Actor"><span className="text-sm">{l.actor_email ?? "System"}</span></TD>
                    <TD label="Change"><span className="block max-w-md break-words text-xs text-muted">{[l.before && `from ${summary(l.before)}`, l.after && summary(l.after)].filter(Boolean).join(" → ")}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
