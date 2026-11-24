"use client";

import { History } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Table, TD, THead, TR } from "@/components/ui/table";
import { Badge, TASK_STATUS } from "@/components/ui/status";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMyTasks } from "@/lib/hooks";

export default function HistoryPage() {
  const { data, isLoading, error, refetch } = useMyTasks();
  const rows = (data ?? []).filter((t) => !["ASSIGNED", "PICKED_UP"].includes(t.status));
  return (
    <>
      <PageHeader title="Delivery history" description="Pickups you've completed or that were closed." />
      <Panel>
        {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
          <EmptyState icon={History} title="No deliveries yet">Completed deliveries are listed here with the time each handover was confirmed.</EmptyState>
        ) : (
          <Table>
            <THead columns={[{ label: "Food" }, { label: "Route" }, { label: "Collected" }, { label: "Delivered" }, { label: "Status" }]} />
            <tbody>
              {rows.map((t) => (
                <TR key={t.task_id}>
                  <TD label="Food"><span className="font-semibold">{t.title}</span><p className="text-xs text-muted tabular">{t.quantity} {t.unit}</p></TD>
                  <TD label="Route"><span className="text-sm">{t.donor_name} → {t.dropoff_name}</span></TD>
                  <TD label="Collected"><span className="tabular">{formatDateTime(t.picked_up_at)}</span></TD>
                  <TD label="Delivered"><span className="tabular">{formatDateTime(t.delivered_at)}</span></TD>
                  <TD label="Status"><Badge tone={TASK_STATUS[t.status]?.tone}>{TASK_STATUS[t.status]?.label ?? t.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
