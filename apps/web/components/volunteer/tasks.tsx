"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Clock, Inbox, Navigation } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, TASK_STATUS } from "@/components/ui/status";
import { Alert, EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ReportIssueDialog } from "@/components/shared/donation-detail";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, minutesUntil, relativeTime } from "@/lib/format";
import { useAvailableTasks, useMyTasks } from "@/lib/hooks";
import { directionsUrl } from "@/lib/places";
import type { PickupTask } from "@/lib/types";
import { cn } from "@/lib/cn";

function Leg({ task }: { task: PickupTask }) {
  return (
    <div className="grid gap-1 text-sm">
      <p><span className="font-semibold">Collect from</span> {task.donor_name} <span className="text-muted">· {task.pickup_address}</span></p>
      <ArrowDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      <p><span className="font-semibold">Deliver to</span> {task.dropoff_name ?? "—"} <span className="text-muted">· {task.dropoff_address ?? "—"}</span></p>
    </div>
  );
}

function Deadline({ value }: { value: string }) {
  const mins = minutesUntil(value) ?? 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm tabular", mins < 60 ? "font-semibold text-danger-text" : "text-muted")}>
      <Clock className="h-3.5 w-3.5" aria-hidden /> Collect by {formatDateTime(value)} ({relativeTime(value)})
    </span>
  );
}

export function AvailableTasks({ limit }: { limit?: number }) {
  const { data, isLoading, error, refetch } = useAvailableTasks();
  const qc = useQueryClient();
  const { notify } = useToast();
  const [accepting, setAccepting] = useState<PickupTask | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = (data?.tasks ?? []).slice(0, limit ?? 100);

  async function accept() {
    if (!accepting) return;
    setBusy(true);
    try {
      await api(`/pickups/accept/${accepting.donation_id}`, { method: "POST" });
      notify("Pickup accepted. It's now in My assignments.");
      setAccepting(null);
      qc.invalidateQueries({ queryKey: ["available-tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    } catch (e) {
      notify(errorMessage(e), "error");
      qc.invalidateQueries({ queryKey: ["available-tasks"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      {data && !data.profile_complete && <div className="p-5"><Alert tone="warning">Complete your volunteer profile to accept tasks.</Alert></div>}
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={Inbox} title="No pickups need a volunteer right now">When an NGO claims a donation, the pickup appears here. This list refreshes every minute.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((t) => (
            <li key={t.donation_id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{t.title}</p>
                  <span className="text-sm text-muted tabular">{t.quantity} {t.unit}</span>
                  {t.distance_km != null && <Badge tone="neutral" dot={false}>{t.distance_km} km from you</Badge>}
                </div>
                <Leg task={t} />
                <Deadline value={t.pickup_deadline} />
              </div>
              <Button onClick={() => setAccepting(t)} disabled={!data?.profile_complete}>Accept pickup</Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!accepting}
        onClose={() => setAccepting(null)}
        onConfirm={accept}
        loading={busy}
        title="Accept this pickup?"
        body={accepting && <>You’re committing to collect <strong>{accepting.title}</strong> from {accepting.donor_name} by {formatDateTime(accepting.pickup_deadline)} and deliver it to {accepting.dropoff_name}.</>}
        confirmLabel="Accept pickup"
      />
    </Panel>
  );
}

export function AssignmentCard({ task, origin }: { task: PickupTask; origin?: { lat?: number | null; lng?: number | null } | null }) {
  const [reporting, setReporting] = useState(false);
  const collecting = task.status === "ASSIGNED";
  const dest = collecting
    ? { lat: task.pickup_latitude, lng: task.pickup_longitude }
    : task.dropoff_latitude != null ? { lat: task.dropoff_latitude, lng: task.dropoff_longitude! } : null;
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-md font-semibold">{task.title}</p>
          <p className="text-sm text-muted tabular">{task.quantity} {task.unit}</p>
        </div>
        <Badge tone={TASK_STATUS[task.status]?.tone}>{TASK_STATUS[task.status]?.label ?? task.status}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        <Leg task={task} />
        {collecting && <Deadline value={task.pickup_deadline} />}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {dest && (
          <a href={directionsUrl(origin ?? null, dest)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-canvas">
            <Navigation className="h-4 w-4" aria-hidden /> Directions to {collecting ? "pickup" : "drop-off"}
          </a>
        )}
        <ButtonLink href={`/dashboard/volunteer/verify?task=${task.task_id}`}>{collecting ? "Enter pickup code" : "Enter delivery code"}</ButtonLink>
        <Button variant="ghost" onClick={() => setReporting(true)}>Report an issue</Button>
      </div>
      <ReportIssueDialog open={reporting} onClose={() => setReporting(false)} donationId={task.donation_id} />
    </Panel>
  );
}

export function ActiveAssignments({ origin }: { origin?: { lat?: number | null; lng?: number | null } | null }) {
  const { data, isLoading, error, refetch } = useMyTasks();
  const active = (data ?? []).filter((t) => t.status === "ASSIGNED" || t.status === "PICKED_UP");
  if (isLoading) return <Panel><LoadingRows /></Panel>;
  if (error) return <Panel><ErrorState message={errorMessage(error)} onRetry={refetch} /></Panel>;
  if (!active.length) {
    return (
      <Panel>
        <EmptyState icon={Inbox} title="No active assignments" action={<ButtonLink href="/dashboard/volunteer/tasks" variant="secondary">Find a pickup</ButtonLink>}>
          Pickups you accept appear here until they’re delivered.
        </EmptyState>
      </Panel>
    );
  }
  return <div className="space-y-4">{active.map((t) => <AssignmentCard key={t.task_id} task={t} origin={origin} />)}</div>;
}
