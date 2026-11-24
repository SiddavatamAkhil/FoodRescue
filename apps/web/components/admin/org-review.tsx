"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/panel";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { VerificationBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { DOC_LABELS } from "@/components/shared/document-upload";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { categoryLabel } from "@/lib/places";
import { ORG_TYPE_LABEL, type AdminOrg } from "./types";
import type { VerificationStatus } from "@/lib/types";

const PROFILE_LABELS: Record<string, string> = {
  business_category: "Business category", city: "City", contact_name: "Contact", contact_phone: "Contact phone",
  operating_hours: "Operating hours", industry: "Industry", cin_or_gstin: "CIN / GSTIN", representative_name: "Representative",
  representative_designation: "Designation", contact_email: "Contact email",
};

export function OrgReviewDialog({ org, open, onClose }: { org: AdminOrg | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<VerificationStatus | null>(null);
  const [err, setErr] = useState("");
  if (!org) return null;
  const p = org.profile ?? {};

  async function decide(status: VerificationStatus) {
    if ((status === "REJECTED" || status === "INFO_REQUIRED" || status === "SUSPENDED") && notes.trim().length < 5) {
      setErr("Add a note telling the organisation what to do. They'll see it.");
      return;
    }
    setBusy(status);
    setErr("");
    try {
      await api(`/organizations/${org!.id}/verify`, { json: { status, notes: notes.trim() || null } });
      notify(`${org!.name}: ${status === "VERIFIED" ? "verified" : status === "UNDER_REVIEW" ? "marked under review" : status === "INFO_REQUIRED" ? "information requested" : status === "SUSPENDED" ? "suspended" : "rejected"}`);
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setNotes("");
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const details = [
    { label: "Type", value: ORG_TYPE_LABEL[org.type] },
    { label: "Address", value: org.address },
    ...(org.fssai_number ? [{ label: "FSSAI number", value: <span className="tabular">{org.fssai_number}</span> }] : [{ label: "FSSAI number", value: <span className="text-muted">Not provided</span> }]),
    ...(org.ngo_darpan_id ? [{ label: "Registration no.", value: org.ngo_darpan_id }] : []),
    ...(org.daily_capacity ? [{ label: "Daily capacity", value: `${org.daily_capacity} meals` }] : []),
    ...Object.entries(PROFILE_LABELS).filter(([k]) => p[k]).map(([k, l]) => ({ label: l, value: String(p[k]) })),
    ...(Array.isArray(p.food_categories) && p.food_categories.length ? [{ label: "Food categories", value: (p.food_categories as string[]).map(categoryLabel).join(", ") }] : []),
    { label: "Registered", value: formatDateTime(org.created_at) },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={org.name}
      description={<span className="inline-flex items-center gap-2">Verification review <VerificationBadge status={org.verification_status} /></span>}
      size="lg"
      footer={
        <>
          {org.verification_status === "PENDING" && <Button variant="secondary" onClick={() => decide("UNDER_REVIEW")} loading={busy === "UNDER_REVIEW"}>Start review</Button>}
          {org.verification_status === "VERIFIED" ? (
            <Button variant="danger" onClick={() => decide("SUSPENDED")} loading={busy === "SUSPENDED"}>Suspend</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => decide("REJECTED")} loading={busy === "REJECTED"}>Reject</Button>
              <Button variant="secondary" onClick={() => decide("INFO_REQUIRED")} loading={busy === "INFO_REQUIRED"}>Request information</Button>
              <Button onClick={() => decide("VERIFIED")} loading={busy === "VERIFIED"}>Verify organisation</Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {org.verification_notes && <Alert tone="info" title="Previous reviewer note">{org.verification_notes}</Alert>}
        <KeyValue items={details} />
        <div>
          <h3 className="mb-2 text-sm font-semibold">Documents</h3>
          {!org.documents.length ? (
            <Alert tone="warning">No documents uploaded. Request information before verifying.</Alert>
          ) : (
            <ul className="divide-y divide-line rounded border border-line">
              {org.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <FileText className="h-4 w-4 text-muted" aria-hidden />
                  <span className="flex-1">{DOC_LABELS[d.document_type] ?? d.document_type} <span className="text-muted">· {formatDate(d.created_at)}</span></span>
                  <a href={`/api/backend/organizations/${org.id}/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest hover:underline">Open</a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Field label="Note to the organisation" error={err} hint="Required when rejecting, suspending or requesting information. Shown to the organisation.">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. The FSSAI certificate has expired. Upload the renewed one." />
        </Field>
      </div>
    </Dialog>
  );
}
