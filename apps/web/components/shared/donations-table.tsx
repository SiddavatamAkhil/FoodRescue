"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Download } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { DonationStatusBadge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FilterTabs, Pagination, SearchInput, Table, TD, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { DonationDetailDialog } from "./donation-detail";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { downloadCsv, totalQuantity, useOrgDonations } from "@/lib/hooks";
import type { Donation, DonationStatus, Me } from "@/lib/types";

type Filter = "all" | "draft" | "open" | "progress" | "done" | "closed";
const GROUPS: Record<Exclude<Filter, "all">, DonationStatus[]> = {
  draft: ["DRAFT"],
  open: ["PUBLISHED", "MATCHING"],
  progress: ["CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP", "DELIVERED"],
  done: ["COMPLETED"],
  closed: ["EXPIRED", "CANCELLED", "FAILED", "DISPUTED"],
};
const PAGE = 10;

export function DonationsTable({ me, createHref, initialFilter = "all", only }: { me: Me; createHref: string; initialFilter?: Filter; only?: Filter[] }) {
  const org = me.organization!;
  const { data, isLoading, error, refetch } = useOrgDonations(org.id);
  const qc = useQueryClient();
  const { notify } = useToast();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Donation | null>(null);
  const [confirm, setConfirm] = useState<{ d: Donation; action: "PUBLISHED" | "CANCELLED" } | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = org.verification_status === "VERIFIED";

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const [k, statuses] of Object.entries(GROUPS)) c[k] = data?.filter((d) => statuses.includes(d.status)).length ?? 0;
    return c;
  }, [data]);

  const rows = useMemo(() => {
    let r = data ?? [];
    if (filter !== "all") r = r.filter((d) => GROUPS[filter].includes(d.status));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((d) => d.title.toLowerCase().includes(s) || d.pickup_address.toLowerCase().includes(s));
    }
    return r;
  }, [data, filter, q]);

  async function transition() {
    if (!confirm) return;
    setBusy(true);
    try {
      await api(`/donations/${confirm.d.id}/transition`, { json: { status: confirm.action } });
      notify(confirm.action === "PUBLISHED" ? `"${confirm.d.title}" published` : `"${confirm.d.title}" cancelled`);
      qc.invalidateQueries({ queryKey: ["donations"] });
      qc.invalidateQueries({ queryKey: ["report"] });
      setConfirm(null);
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    downloadCsv(`donations-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Title", "Status", "Quantity", "Unit", "Pickup address", "Pickup deadline (UTC)", "Created (UTC)"],
      ...rows.map((d) => { const t = totalQuantity(d); return [d.title, d.status, t.qty, t.unit, d.pickup_address, d.pickup_deadline, d.created_at]; }),
    ]);
  }

  const tabs = ([
    { value: "all", label: "All" }, { value: "draft", label: "Drafts" }, { value: "open", label: "Open" },
    { value: "progress", label: "In progress" }, { value: "done", label: "Completed" }, { value: "closed", label: "Closed" },
  ] as { value: Filter; label: string }[]).filter((t) => !only || only.includes(t.value)).map((t) => ({ ...t, count: counts[t.value] }));

  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <FilterTabs value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={tabs} />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search title or address" label="Search donations" />
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length} aria-label="Export as CSV"><Download className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Export</span></Button>
        </div>
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={ClipboardList} title={data?.length ? "No donations match" : "No donations yet"} action={!data?.length ? <ButtonLink href={createHref}>Create a donation</ButtonLink> : undefined}>
          {data?.length ? "Try another filter or search term." : "Listings you create appear here with their status, from draft to delivered."}
        </EmptyState>
      ) : (
        <>
          <Table>
            <THead columns={[{ label: "Donation" }, { label: "Status" }, { label: "Quantity", className: "text-right" }, { label: "Pickup by" }, { label: "Actions", srOnly: true }]} />
            <tbody>
              {pageRows.map((d) => {
                const t = totalQuantity(d);
                return (
                  <TR key={d.id}>
                    <TD label="Donation">
                      <button type="button" onClick={() => setSelected(d)} className="text-left font-semibold text-ink hover:text-forest hover:underline">{d.title}</button>
                      <p className="truncate text-xs text-muted">{d.pickup_address}</p>
                    </TD>
                    <TD label="Status"><DonationStatusBadge status={d.status} /></TD>
                    <TD label="Quantity" className="md:text-right"><span className="tabular">{t.qty} {t.unit}</span></TD>
                    <TD label="Pickup by">
                      <span className="tabular">{formatDateTime(d.pickup_deadline)}</span>
                      {["PUBLISHED", "CLAIMED", "PICKUP_ASSIGNED", "DRAFT"].includes(d.status) && <p className="text-xs text-muted">{relativeTime(d.pickup_deadline)}</p>}
                    </TD>
                    <TD label="Actions" className="md:text-right">
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {d.status === "DRAFT" && (
                          <Button size="sm" onClick={() => setConfirm({ d, action: "PUBLISHED" })} disabled={!verified} title={verified ? undefined : "Available once your organisation is verified"}>Publish</Button>
                        )}
                        {["DRAFT", "PUBLISHED"].includes(d.status) && (
                          <Button size="sm" variant="secondary" onClick={() => setConfirm({ d, action: "CANCELLED" })}>Cancel</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setSelected(d)}>View</Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
        </>
      )}
      <DonationDetailDialog donation={selected} viewer="donor" open={!!selected} onClose={() => setSelected(null)} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={transition}
        loading={busy}
        title={confirm?.action === "PUBLISHED" ? "Publish this donation?" : "Cancel this donation?"}
        body={confirm?.action === "PUBLISHED"
          ? <>Verified NGOs within 50 km will be able to claim <strong>{confirm?.d.title}</strong> until {formatDateTime(confirm?.d.pickup_deadline)}.</>
          : <>NGOs will no longer see <strong>{confirm?.d.title}</strong>. This can’t be undone.</>}
        confirmLabel={confirm?.action === "PUBLISHED" ? "Publish" : "Cancel donation"}
        tone={confirm?.action === "CANCELLED" ? "danger" : "primary"}
      />
    </Panel>
  );
}
