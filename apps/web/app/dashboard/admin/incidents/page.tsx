"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FilterTabs } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { INCIDENT_CATEGORY, type Incident } from "@/components/admin/types";

const TONE = { OPEN: "danger", INVESTIGATING: "warning", RESOLVED: "success" } as const;

export default function IncidentsPage() {
  const [filter, setFilter] = useState<"active" | "RESOLVED" | "all">("active");
  const [editing, setEditing] = useState<Incident | null>(null);
  const [status, setStatus] = useState("INVESTIGATING");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { notify } = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["incidents"], queryFn: () => api<Incident[]>("/incidents/") });
  const rows = (data ?? []).filter((i) => filter === "all" || (filter === "active" ? i.status !== "RESOLVED" : i.status === "RESOLVED"));

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/incidents/${editing.id}`, { method: "PATCH", json: { status, resolution_notes: notes } });
      notify("Incident updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Incidents" description="Problems reported by donors, NGOs and volunteers." />
      <Panel>
        <div className="border-b border-line px-5 py-3">
          <FilterTabs value={filter} onChange={setFilter} options={[
            { value: "active", label: "Open", count: data?.filter((i) => i.status !== "RESOLVED").length },
            { value: "RESOLVED", label: "Resolved" }, { value: "all", label: "All" },
          ]} />
        </div>
        {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
          <EmptyState icon={ShieldAlert} title={filter === "active" ? "No open incidents" : "No incidents"}>Reports raised from a donation or assignment appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{INCIDENT_CATEGORY[i.category] ?? i.category}</p>
                    <Badge tone={TONE[i.status]}>{i.status.charAt(0) + i.status.slice(1).toLowerCase()}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{i.description}</p>
                  <p className="mt-1 text-xs text-muted">Reported by {i.reporter_email} · {formatDateTime(i.created_at)}{i.donation_id ? " · linked to a donation" : ""}</p>
                  {i.resolution_notes && <p className="mt-2 text-sm"><span className="font-semibold">Resolution:</span> {i.resolution_notes}</p>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setEditing(i); setStatus(i.status === "OPEN" ? "INVESTIGATING" : i.status); setNotes(i.resolution_notes ?? ""); }}>Update</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Update incident" footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} loading={busy}>Save update</Button></>}>
        <div className="space-y-4">
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolved</option></Select></Field>
          <Field label="Notes" optional><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done, and the outcome" /></Field>
        </div>
      </Dialog>
    </>
  );
}
