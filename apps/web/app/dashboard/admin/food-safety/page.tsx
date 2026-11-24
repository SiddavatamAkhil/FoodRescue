"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert, LoadingRows } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDateTime, minutesUntil, relativeTime } from "@/lib/format";
import { useAiStatus } from "@/lib/hooks";
import type { AdminDonation } from "@/components/admin/types";
import type { Paged } from "@/lib/types";

type Answer = { answer: string; status: "ANSWERED" | "ABSTAIN"; citations: { document: string; source_url?: string; section: string }[] };

function KnowledgeQuery() {
  const ai = useAiStatus();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Answer | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true); setErr(""); setRes(null);
    try { setRes(await api<Answer>("/ai/knowledge-query", { json: { question: q.trim() } })); }
    catch (e2) { setErr(errorMessage(e2)); }
    finally { setBusy(false); }
  }
  if (ai.isLoading) return <LoadingRows rows={2} />;
  if (!ai.data?.knowledge_assistant) {
    return <PanelBody><p className="text-sm text-muted">Answer generation isn’t available because no language model is configured on this server. Regulatory documents can still be added below so they’re ready when it is.</p></PanelBody>;
  }
  return (
    <PanelBody className="space-y-4">
      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What temperature must cooked surplus be held at for redistribution?" aria-label="Question" />
        <Button type="submit" loading={busy}>Ask</Button>
      </form>
      {err && <Alert tone="danger">{err}</Alert>}
      {res && (
        <div className="space-y-3 rounded border border-line p-4">
          {res.status === "ABSTAIN" ? <Alert tone="warning" title="No authoritative answer">{res.answer}</Alert> : <p className="text-sm">{res.answer}</p>}
          {res.citations.length > 0 && (
            <div><p className="text-xs font-semibold text-muted">Sources</p>
              <ul className="mt-1 space-y-1 text-sm">{res.citations.map((c, i) => <li key={i}>{c.source_url ? <a className="link" href={c.source_url} target="_blank" rel="noopener noreferrer">{c.document}</a> : c.document} <span className="text-muted">· {c.section}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </PanelBody>
  );
}

function IngestForm() {
  const { notify } = useToast();
  const [f, setF] = useState({ title: "", source_url: "", content: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.title.trim().length < 3) errs.title = "Enter the document title.";
    if (!/^https?:\/\/\S+$/.test(f.source_url.trim())) errs.source_url = "Enter the official source URL.";
    if (f.content.trim().length < 50) errs.content = "Paste the document text (at least a paragraph).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await api<{ chunks_created: number }>("/ai/knowledge-ingest", { json: f });
      notify(`Document added (${r.chunks_created} passages indexed)`);
      setF({ title: "", source_url: "", content: "" });
    } catch (e2) {
      if (e2 instanceof ApiError) setErrors(e2.fieldErrors);
      notify(errorMessage(e2), "error");
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate>
      <PanelBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={errors.title}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="FSS (Recovery and Distribution of Surplus Food) Regulations, 2019" /></Field>
          <Field label="Official source URL" error={errors.source_url}><Input value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} placeholder="https://fssai.gov.in/…" /></Field>
        </div>
        <Field label="Document text" error={errors.content}><Textarea rows={6} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
        <Button type="submit" variant="secondary" loading={busy}>Add to knowledge base</Button>
      </PanelBody>
    </form>
  );
}

export default function FoodSafetyPage() {
  const open = useQuery({ queryKey: ["admin-donations", "safety-open"], queryFn: () => api<Paged<AdminDonation>>("/admin/donations?status_filter=PUBLISHED&limit=200"), refetchInterval: 60_000 });
  const atRisk = (open.data?.items ?? []).filter((d) => { const m = minutesUntil(d.pickup_deadline); return m !== null && m > 0 && m <= 120; });
  return (
    <>
      <PageHeader title="Food safety" description="Listings close to their safe time, and the regulatory reference used across the platform." />
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Listings near their deadline" description="Published and unclaimed with less than two hours left. Contact nearby NGOs or the donor." />
          {open.isLoading ? <LoadingRows rows={3} /> : !atRisk.length ? <p className="px-5 py-6 text-sm text-muted">No listings are close to their deadline.</p> : (
            <ul className="divide-y divide-line">
              {atRisk.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span><span className="font-semibold">{d.title}</span> <span className="text-muted">from {d.donor_name}, {d.pickup_address}</span></span>
                  <span className="font-semibold text-danger-text tabular">{relativeTime(d.pickup_deadline)} ({formatDateTime(d.pickup_deadline)})</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Platform rules in force" />
          <PanelBody>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <li><span className="font-semibold">Plate leftovers refused</span><br /><span className="text-muted">Rejected by schema validation and by the listing assistant.</span></li>
              <li><span className="font-semibold">Deadline in the future</span><br /><span className="text-muted">Listings with a past pickup deadline can’t be created or published.</span></li>
              <li><span className="font-semibold">Automatic expiry</span><br /><span className="text-muted">Published listings past their deadline are closed by the escalation job.</span></li>
              <li><span className="font-semibold">Verified parties only</span><br /><span className="text-muted">Publishing and claiming require a verified organisation.</span></li>
            </ul>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Regulation questions" description="Answers come only from documents in the knowledge base, with sources. If they don't cover the question, the assistant says so." />
          <KnowledgeQuery />
        </Panel>
        <Panel>
          <PanelHeader title="Add a regulatory document" description="Paste the text of an official document. It's split into passages for search." />
          <IngestForm />
        </Panel>
      </div>
    </>
  );
}
