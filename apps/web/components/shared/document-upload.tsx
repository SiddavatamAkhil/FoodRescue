"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Upload } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";

export const DOC_LABELS: Record<string, string> = {
  fssai_license: "FSSAI registration or licence",
  ngo_registration: "NGO registration certificate",
  pan: "PAN card",
  gst_certificate: "GST certificate",
  identity_proof: "Identity proof of signatory",
  other: "Other document",
};

type Doc = { id: string; document_type: string; status: string; created_at: string };

export function DocumentUpload({ orgId, required }: { orgId: string; required: string[] }) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const docs = useQuery({ queryKey: ["docs", orgId], queryFn: () => api<Doc[]>(`/organizations/${orgId}/documents`) });
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const types = Array.from(new Set([...required, "identity_proof", "other"]));

  async function upload(type: string, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      notify("Files must be 5 MB or smaller.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("document_type", type);
    fd.set("file", file);
    setBusy(type);
    try {
      await api(`/organizations/${orgId}/documents`, { form: fd });
      notify(`${DOC_LABELS[type]} uploaded`);
      qc.invalidateQueries({ queryKey: ["docs", orgId] });
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="divide-y divide-line rounded-md border border-line bg-surface">
      {types.map((t) => {
        const uploaded = docs.data?.filter((d) => d.document_type === t) ?? [];
        return (
          <li key={t} className="flex flex-wrap items-center gap-4 px-4 py-3">
            {uploaded.length ? <FileCheck2 className="h-5 w-5 text-success" aria-hidden /> : <Upload className="h-5 w-5 text-muted" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {DOC_LABELS[t]}
                {required.includes(t) ? null : <span className="ml-1 font-normal text-muted">(optional)</span>}
              </p>
              <p className="text-sm text-muted">
                {uploaded.length ? `Uploaded ${formatDate(uploaded[0].created_at)}` : "PDF, JPG or PNG, up to 5 MB"}
              </p>
            </div>
            {uploaded.length > 0 && <Badge tone={uploaded[0].status === "VERIFIED" ? "success" : "warning"}>{uploaded[0].status === "VERIFIED" ? "Accepted" : "Awaiting review"}</Badge>}
            <input
              ref={(el) => { inputs.current[t] = el; }}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              aria-label={`Upload ${DOC_LABELS[t]}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(t, f);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" size="sm" loading={busy === t} onClick={() => inputs.current[t]?.click()}>
              {uploaded.length ? "Replace" : "Upload"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
