"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { Alert, EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useDemands } from "@/lib/hooks";
import { categoryLabel, FOOD_CATEGORIES } from "@/lib/places";
import type { Demand, Me } from "@/lib/types";

const PRIORITY = { high: { label: "High", tone: "danger" as const }, medium: { label: "Medium", tone: "warning" as const }, low: { label: "Low", tone: "neutral" as const } };

export function Requirements({ me, compact = false }: { me: Me; compact?: boolean }) {
  const org = me.organization!;
  const { data, isLoading, error, refetch } = useDemands(org.id);
  const qc = useQueryClient();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Demand | null>(null);
  const [form, setForm] = useState({ food_category: "cooked_veg", quantity_needed: "", unit: "meals", priority: "medium" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verified = org.verification_status === "VERIFIED";
  const rows = compact ? (data ?? []).slice(0, 4) : data ?? [];

  async function create() {
    if (!(Number(form.quantity_needed) > 0)) { setErr("Enter the quantity you need."); return; }
    setBusy(true);
    try {
      await api(`/demands/?org_id=${org.id}`, { json: { ...form, quantity_needed: Number(form.quantity_needed), latitude: org.latitude, longitude: org.longitude } });
      notify("Requirement added");
      setOpen(false);
      setForm({ food_category: "cooked_veg", quantity_needed: "", unit: "meals", priority: "medium" });
      setErr("");
      qc.invalidateQueries({ queryKey: ["demands"] });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/demands/${del.id}`, { method: "DELETE" });
      notify("Requirement removed");
      setDel(null);
      qc.invalidateQueries({ queryKey: ["demands"] });
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={compact ? "Current food requirements" : "Requirements"}
        description={compact ? undefined : "Standing needs that inform matching and your demand forecast."}
        action={<Button size="sm" variant={compact ? "secondary" : "primary"} onClick={() => setOpen(true)} disabled={!verified} title={verified ? undefined : "Available once your organisation is verified"}><Plus className="h-4 w-4" aria-hidden /> Add requirement</Button>}
      />
      {!verified && !compact && <div className="px-5 pt-4"><Alert tone="warning">You can add requirements once your organisation is verified.</Alert></div>}
      {isLoading ? <LoadingRows rows={3} /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={ListChecks} title="No requirements recorded">Record what you regularly need, such as 200 veg meals a day or 50 kg of rice a week.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{categoryLabel(d.food_category)}</p>
                <p className="text-sm text-muted tabular">{d.quantity_needed} {d.unit} · added {formatDate(d.created_at)}</p>
              </div>
              <Badge tone={PRIORITY[d.priority]?.tone ?? "neutral"}>{PRIORITY[d.priority]?.label ?? d.priority} priority</Badge>
              {!compact && <Button size="sm" variant="ghost" onClick={() => setDel(d)} aria-label={`Remove ${categoryLabel(d.food_category)} requirement`}><Trash2 className="h-4 w-4" aria-hidden /></Button>}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a food requirement" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Add requirement</Button></>}>
        <div className="space-y-4">
          <Field label="Food category"><Select value={form.food_category} onChange={(e) => setForm({ ...form, food_category: e.target.value })}>{FOOD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity needed" error={err}><Input type="number" min={1} value={form.quantity_needed} onChange={(e) => setForm({ ...form, quantity_needed: e.target.value })} /></Field>
            <Field label="Unit"><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="meals">Meals</option><option value="kg">Kilograms</option><option value="packets">Packets</option><option value="litres">Litres</option></Select></Field>
          </div>
          <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="high">High: we’re short now</option><option value="medium">Medium</option><option value="low">Low: would help</option></Select></Field>
        </div>
      </Dialog>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} title="Remove this requirement?" body="It will no longer be used for matching or forecasting." confirmLabel="Remove" tone="danger" />
    </Panel>
  );
}
