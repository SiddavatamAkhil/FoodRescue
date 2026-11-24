"use client";

import { useState } from "react";
import { Flag, MapPin } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DonationStatusBadge } from "@/components/ui/status";
import { KeyValue } from "@/components/ui/panel";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { CustodyChain, type ChainStep } from "./custody-chain";
import { CustodyCode } from "./qr-code";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useDonationPickup, totalQuantity } from "@/lib/hooks";
import type { Donation } from "@/lib/types";

type HistoryEntry = { status: string; timestamp: string };

const ORDER = ["PUBLISHED", "CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP", "COMPLETED"];

export function donationTimeline(d: Donation & { state_history?: HistoryEntry[] }, pickup?: { picked_up_at?: string | null; delivered_at?: string | null; volunteer_name?: string | null } | null): ChainStep[] {
  const history = (d.state_history ?? []) as HistoryEntry[];
  const when = (s: string) => history.filter((h) => h.status === s).pop()?.timestamp;
  const reached = Math.max(-1, ORDER.indexOf(d.status === "DELIVERED" ? "COMPLETED" : d.status));
  const stopped = ["EXPIRED", "CANCELLED", "FAILED", "DISPUTED"].includes(d.status);
  const steps: { key: string; title: string; detail: string; time?: string | null }[] = [
    { key: "PUBLISHED", title: "Published", detail: "Visible to verified NGOs nearby.", time: when("PUBLISHED") },
    { key: "CLAIMED", title: "Claimed by an NGO", detail: "Locked to one recipient.", time: when("CLAIMED") },
    { key: "PICKUP_ASSIGNED", title: "Volunteer assigned", detail: pickup?.volunteer_name ? `${pickup.volunteer_name} is collecting.` : "Waiting for a volunteer to accept.", time: when("PICKUP_ASSIGNED") },
    { key: "PICKED_UP", title: "Collected from donor", detail: "Confirmed with the donor's pickup code.", time: pickup?.picked_up_at ?? when("PICKED_UP") },
    { key: "COMPLETED", title: "Delivered", detail: "Confirmed with the NGO's delivery code.", time: pickup?.delivered_at ?? when("COMPLETED") },
  ];
  // For stopped listings, work out the last reached stage from history.
  const lastIdx = stopped ? Math.max(-1, ...history.map((h) => ORDER.indexOf(h.status))) : reached;
  return steps.map((s, i) => ({
    title: s.title,
    detail: s.detail,
    meta: s.time ? formatDateTime(s.time) : undefined,
    state: i <= lastIdx ? "done" : stopped && i === lastIdx + 1 ? "stopped" : i === lastIdx + 1 && d.status !== "DRAFT" ? "current" : "upcoming",
  })) as ChainStep[];
}

export function DonationDetailDialog({
  donation, viewer, open, onClose,
}: { donation: Donation | null; viewer: "donor" | "ngo" | "admin"; open: boolean; onClose: () => void }) {
  const active = !!donation && ["PICKUP_ASSIGNED", "PICKED_UP", "CLAIMED", "COMPLETED"].includes(donation.status);
  const pickup = useDonationPickup(donation?.id, open && active && viewer !== "admin");
  const [reporting, setReporting] = useState(false);
  if (!donation) return null;
  const { qty, unit } = totalQuantity(donation);
  const task = pickup.data?.task;
  const stoppedNote: Record<string, string> = {
    EXPIRED: "The pickup deadline passed before this listing was claimed.",
    CANCELLED: "This listing was cancelled.",
    FAILED: "This rescue could not be completed.",
    DISPUTED: "An issue has been raised on this rescue and is being reviewed.",
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={donation.title}
        description={<span className="inline-flex items-center gap-2"><DonationStatusBadge status={donation.status} /> {qty} {unit}</span>}
        size="lg"
        footer={
          <>
            {viewer !== "admin" && donation.status !== "DRAFT" && (
              <Button variant="ghost" onClick={() => setReporting(true)}><Flag className="h-4 w-4" aria-hidden /> Report an issue</Button>
            )}
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </>
        }
      >
        <div className="space-y-6">
          {stoppedNote[donation.status] && <Alert tone="warning">{stoppedNote[donation.status]}</Alert>}

          {task?.pickup_code && (
            <CustodyCode code={task.pickup_code} label="Pickup code" help={`Show this to ${task.volunteer_name ?? "the volunteer"} when they collect the food. It works once.`} />
          )}
          {task?.delivery_code && (
            <CustodyCode code={task.delivery_code} label="Delivery code" help={`Show this to ${task.volunteer_name ?? "the volunteer"} when the food arrives. Only share it once you've received the food.`} />
          )}
          {pickup.isLoading && active && <Skeleton className="h-24 w-full" />}

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Progress</h3>
              {donation.status === "DRAFT" ? (
                <p className="text-sm text-muted">Draft. Publish it to make it visible to NGOs.</p>
              ) : (
                <CustodyChain compact steps={donationTimeline(donation, task)} />
              )}
            </div>
            <div className="space-y-5">
              <div>
                <h3 className="mb-1 text-sm font-semibold">Pickup</h3>
                <p className="flex gap-1.5 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />{donation.pickup_address}</p>
                <p className="mt-1 text-sm text-muted">Deadline {formatDateTime(donation.pickup_deadline)} ({relativeTime(donation.pickup_deadline)})</p>
                {donation.storage_info && <p className="mt-1 text-sm text-muted">Storage: {donation.storage_info}</p>}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Items</h3>
                <KeyValue items={donation.food_items.map((i) => ({
                  label: i.name,
                  value: <span className="tabular">{i.quantity} {i.unit} · {i.is_veg ? "Veg" : "Non-veg"} · use by {formatDateTime(i.expiry_time)}</span>,
                }))} />
              </div>
              {donation.description && <p className="text-sm text-ink-soft">{donation.description}</p>}
            </div>
          </div>
        </div>
      </Dialog>
      <ReportIssueDialog open={reporting} onClose={() => setReporting(false)} donationId={donation.id} />
    </>
  );
}

export function ReportIssueDialog({ open, onClose, donationId }: { open: boolean; onClose: () => void; donationId?: string }) {
  const { notify } = useToast();
  const [category, setCategory] = useState("no_show");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (description.trim().length < 10) {
      setErr("Describe what happened in at least 10 characters.");
      return;
    }
    setSaving(true);
    try {
      await api("/incidents/", { json: { donation_id: donationId ?? null, category, description: description.trim() } });
      notify("Issue reported. The operations team has been notified.");
      setDescription("");
      setErr("");
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Report an issue"
      description="Reports go to FoodRescue operations with this rescue attached."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving}>Send report</Button></>}
    >
      <div className="space-y-4">
        <Field label="What went wrong?">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="no_show">Nobody turned up</option>
            <option value="quantity_mismatch">Quantity didn’t match the listing</option>
            <option value="food_safety">Food safety concern</option>
            <option value="packaging">Packaging was damaged or unsuitable</option>
            <option value="other">Something else</option>
          </Select>
        </Field>
        <Field label="Details" error={err}>
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, and when?" />
        </Field>
      </div>
    </Dialog>
  );
}
