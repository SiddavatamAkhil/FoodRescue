"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelHeader, StatStrip } from "@/components/ui/panel";
import { Badge, VerificationBadge } from "@/components/ui/status";
import { ErrorState, LoadingRows, Skeleton } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { INCIDENT_CATEGORY, ORG_TYPE_LABEL, type AdminDonation, type AdminOrg, type Incident } from "@/components/admin/types";
import type { Paged } from "@/lib/types";

type Overview = { pending_verifications: number; active_operations: number; open_listings: number; at_risk_listings: number; open_incidents: number; total_users: number; total_organizations: number; completed_rescues: number };
type Contact = { id: string; name: string; email: string; organization?: string | null; topic: string; message: string; created_at: string };

export default function AdminOverview() {
  const ov = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<Overview>("/admin/overview"), refetchInterval: 60_000 });
  const pending = useQuery({ queryKey: ["admin-orgs", "overview-pending"], queryFn: () => api<Paged<AdminOrg>>("/admin/organizations?status_filter=PENDING&limit=5") });
  const active = useQuery({ queryKey: ["admin-donations", "overview-active"], queryFn: () => api<Paged<AdminDonation>>("/admin/donations?status_filter=PICKED_UP&limit=5") });
  const incidents = useQuery({ queryKey: ["incidents"], queryFn: () => api<Incident[]>("/incidents/") });
  const contact = useQuery({ queryKey: ["contact"], queryFn: () => api<Contact[]>("/admin/contact-messages?limit=5") });
  const o = ov.data;

  return (
    <>
      <PageHeader title="Operations overview" description="What needs attention across the network right now." />
      <div className="space-y-6">
        {ov.isLoading ? <Skeleton className="h-24 w-full" /> : ov.error ? <Panel><ErrorState message={errorMessage(ov.error)} onRetry={ov.refetch} /></Panel> : o && (
          <StatStrip items={[
            { label: "Verifications waiting", value: o.pending_verifications, note: "Pending or under review" },
            { label: "Rescues in progress", value: o.active_operations, note: "Claimed to in transit" },
            { label: "At-risk listings", value: <span className={o.at_risk_listings ? "text-danger-text" : ""}>{o.at_risk_listings}</span>, note: `Of ${o.open_listings} open, under 2 h to deadline` },
            { label: "Open incidents", value: o.open_incidents, note: `${o.completed_rescues} rescues completed in total` },
          ]} />
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="New verification requests" action={<Link href="/dashboard/admin/verification" className="text-sm font-semibold text-forest hover:underline">Review queue</Link>} />
            {pending.isLoading ? <LoadingRows rows={3} /> : !pending.data?.items.length ? <p className="px-5 py-6 text-sm text-muted">No new requests.</p> : (
              <ul className="divide-y divide-line">
                {pending.data.items.map((org) => (
                  <li key={org.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><p className="truncate font-semibold">{org.name}</p><p className="text-xs text-muted">{ORG_TYPE_LABEL[org.type]} · {relativeTime(org.created_at)} · {org.documents.length} document{org.documents.length === 1 ? "" : "s"}</p></div>
                    <VerificationBadge status={org.verification_status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Reported incidents" action={<Link href="/dashboard/admin/incidents" className="text-sm font-semibold text-forest hover:underline">All incidents</Link>} />
            {incidents.isLoading ? <LoadingRows rows={3} /> : !incidents.data?.filter((i) => i.status !== "RESOLVED").length ? <p className="px-5 py-6 text-sm text-muted">No open incidents.</p> : (
              <ul className="divide-y divide-line">
                {incidents.data.filter((i) => i.status !== "RESOLVED").slice(0, 5).map((i) => (
                  <li key={i.id} className="px-5 py-3">
                    <div className="flex items-center gap-2"><p className="font-semibold">{INCIDENT_CATEGORY[i.category]}</p>{i.category === "food_safety" && <Badge tone="danger">Safety</Badge>}</div>
                    <p className="truncate text-sm text-muted">{i.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="In transit now" action={<Link href="/dashboard/admin/operations" className="text-sm font-semibold text-forest hover:underline">All operations</Link>} />
            {active.isLoading ? <LoadingRows rows={3} /> : !active.data?.items.length ? <p className="px-5 py-6 text-sm text-muted">No food is in transit.</p> : (
              <ul className="divide-y divide-line">
                {active.data.items.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate"><span className="font-semibold">{d.title}</span> <span className="text-muted">from {d.donor_name}</span></span>
                    <span className="shrink-0 text-muted tabular">{d.quantity} {d.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Contact enquiries" description={o ? `${o.total_users} users and ${o.total_organizations} organisations registered` : undefined} />
            {contact.isLoading ? <LoadingRows rows={3} /> : !contact.data?.length ? <p className="px-5 py-6 text-sm text-muted">No messages from the contact page yet.</p> : (
              <ul className="divide-y divide-line">
                {contact.data.map((m) => (
                  <li key={m.id} className="px-5 py-3 text-sm">
                    <p><span className="font-semibold">{m.name}</span> <a className="link" href={`mailto:${m.email}`}>{m.email}</a> <span className="text-xs text-muted">· {formatDateTime(m.created_at)}</span></p>
                    <p className="mt-0.5 line-clamp-2 text-ink-soft">{m.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
