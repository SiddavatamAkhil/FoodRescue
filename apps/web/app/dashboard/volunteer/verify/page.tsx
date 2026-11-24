"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, EmptyState, LoadingRows } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useMyTasks } from "@/lib/hooks";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function Scanner({ onCode, onClose }: { onCode: (c: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new Ctor!({ formats: ["qr_code"] });
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const found = await det.detect(video.current);
            if (found[0]?.rawValue) { onCode(found[0].rawValue); return; }
          } catch { /* keep scanning */ }
          requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErr("Camera access was blocked. Type the code instead.");
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="space-y-3">
      {err ? <Alert tone="warning">{err}</Alert> : <video ref={video} className="aspect-square w-full max-w-xs rounded bg-ink object-cover" muted playsInline aria-label="Camera preview" />}
      <Button variant="secondary" size="sm" onClick={onClose}>Stop camera</Button>
    </div>
  );
}

function Verify() {
  const params = useSearchParams();
  const { data, isLoading } = useMyTasks();
  const qc = useQueryClient();
  const { notify } = useToast();
  const active = (data ?? []).filter((t) => t.status === "ASSIGNED" || t.status === "PICKED_UP");
  const [taskId, setTaskId] = useState(params.get("task") ?? "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const canScan = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  useEffect(() => {
    if (!taskId && active.length) setTaskId(active[0].task_id);
  }, [active, taskId]);

  const task = active.find((t) => t.task_id === taskId);
  const stage = task?.status === "ASSIGNED" ? "HANDOFF" : "DELIVERY";

  async function submit(e?: React.FormEvent, value?: string) {
    e?.preventDefault();
    const c = (value ?? code).trim();
    if (!task) return;
    if (c.length < 10) { setErr("Enter the full code, or scan the QR code."); return; }
    setBusy(true);
    setErr("");
    try {
      await api(`/pickups/verify-handoff?qr_token=${encodeURIComponent(c)}&event_type=${stage}`, { method: "POST" });
      setDone(stage === "HANDOFF" ? `Pickup confirmed. Take "${task.title}" to ${task.dropoff_name}.` : `Delivery confirmed. "${task.title}" is complete. Thank you.`);
      notify(stage === "HANDOFF" ? "Pickup confirmed" : "Delivery confirmed");
      setCode("");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["vol-stats"] });
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Panel><LoadingRows /></Panel>;
  if (done) {
    return (
      <Panel className="p-8">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
        <p className="mt-3 text-lg font-semibold">{done}</p>
        <Button className="mt-5" variant="secondary" onClick={() => setDone(null)}>Verify another handover</Button>
      </Panel>
    );
  }
  if (!active.length) return <Panel><EmptyState icon={QrCode} title="Nothing to verify">Codes are entered for pickups you’ve accepted. Accept a task first.</EmptyState></Panel>;

  return (
    <Panel>
      <PanelHeader title={stage === "HANDOFF" ? "Confirm pickup" : "Confirm delivery"} description={stage === "HANDOFF" ? "Ask the donor to show the pickup code on their FoodRescue screen." : "Ask the receiving NGO for its delivery code once you've handed the food over."} />
      <PanelBody>
        <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
          {active.length > 1 && (
            <Field label="Assignment">
              <Select value={taskId} onChange={(e) => { setTaskId(e.target.value); setErr(""); }}>
                {active.map((t) => <option key={t.task_id} value={t.task_id}>{t.title} ({t.status === "ASSIGNED" ? "to collect" : "to deliver"})</option>)}
              </Select>
            </Field>
          )}
          {active.length === 1 && task && <p className="text-sm"><span className="font-semibold">{task.title}</span> <span className="text-muted">from {task.donor_name} to {task.dropoff_name}</span></p>}
          {err && <Alert tone="danger">{err}</Alert>}
          {scan ? (
            <Scanner onCode={(c) => { setScan(false); setCode(c); submit(undefined, c); }} onClose={() => setScan(false)} />
          ) : (
            <>
              <Field label={stage === "HANDOFF" ? "Pickup code" : "Delivery code"} hint="Codes work once. A code for the wrong step is rejected.">
                <Input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy}>{stage === "HANDOFF" ? "Confirm pickup" : "Confirm delivery"}</Button>
                {canScan && <Button variant="secondary" onClick={() => setScan(true)}><Camera className="h-4 w-4" aria-hidden /> Scan QR code</Button>}
              </div>
            </>
          )}
        </form>
      </PanelBody>
    </Panel>
  );
}

export default function VerifyPage() {
  return (<><PageHeader title="Pickup verification" description="Each handover is confirmed with a single-use code held by the other party." /><Suspense><Verify /></Suspense></>);
}
