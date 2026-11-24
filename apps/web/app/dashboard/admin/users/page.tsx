"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Pagination, SearchInput, Table, TD, THead, TR } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";
import { ROLE_LABEL, useMe } from "@/lib/session";
import type { AdminUser } from "@/components/admin/types";
import type { Paged, Role } from "@/lib/types";

const PAGE = 20;

export default function UsersPage() {
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { notify } = useToast();
  const params = new URLSearchParams({ limit: String(PAGE), offset: String((page - 1) * PAGE) });
  if (q.trim()) params.set("q", q.trim());
  if (role) params.set("role", role);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-users", params.toString()], queryFn: () => api<Paged<AdminUser>>(`/admin/users?${params}`) });

  async function toggle() {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/admin/users/${target.id}/active?active=${!target.is_active}`, { method: "POST" });
      notify(`${target.full_name} ${target.is_active ? "deactivated" : "reactivated"}`);
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Users" description="Everyone with a FoodRescue account." />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="h-9 w-48 text-sm" aria-label="Role">
            <option value="">All roles</option>
            {(["DONOR", "RECIPIENT", "VOLUNTEER", "CORPORATE", "OPS_MANAGER", "ADMIN"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or email" label="Search users" />
        </div>
        {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState icon={Users} title="No users found">Try a different search or role.</EmptyState>
        ) : (
          <>
            <Table>
              <THead columns={[{ label: "User" }, { label: "Role" }, { label: "Status" }, { label: "Joined" }, { label: "Last sign-in" }, { label: "Actions", srOnly: true }]} />
              <tbody>
                {data.items.map((u) => (
                  <TR key={u.id}>
                    <TD label="User"><span className="font-semibold">{u.full_name}</span><p className="text-xs text-muted">{u.email}</p></TD>
                    <TD label="Role">{ROLE_LABEL[u.role as Role] ?? u.role}</TD>
                    <TD label="Status">
                      <div className="flex flex-wrap gap-1">
                        {u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}
                        {!u.email_verified && <Badge tone="neutral">Email unconfirmed</Badge>}
                        {!u.onboarding_completed && !["ADMIN", "OPS_MANAGER"].includes(u.role) && <Badge tone="warning">Onboarding incomplete</Badge>}
                      </div>
                    </TD>
                    <TD label="Joined"><span className="tabular">{formatDate(u.created_at)}</span></TD>
                    <TD label="Last sign-in"><span className="text-sm text-muted">{u.last_login_at ? relativeTime(u.last_login_at) : "Never"}</span></TD>
                    <TD label="Actions" className="md:text-right">
                      {u.id !== me?.id && me?.role === "ADMIN" && (
                        <Button size="sm" variant={u.is_active ? "secondary" : "primary"} onClick={() => setTarget(u)}>{u.is_active ? "Deactivate" : "Reactivate"}</Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={toggle}
        loading={busy}
        title={target?.is_active ? "Deactivate this account?" : "Reactivate this account?"}
        body={target?.is_active ? <><strong>{target?.full_name}</strong> will be signed out and can’t sign in again until reactivated.</> : <><strong>{target?.full_name}</strong> will be able to sign in again.</>}
        confirmLabel={target?.is_active ? "Deactivate" : "Reactivate"}
        tone={target?.is_active ? "danger" : "primary"}
      />
    </>
  );
}
