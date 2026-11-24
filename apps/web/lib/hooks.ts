"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Demand, Donation, OrgReport, PickupTask } from "./types";

export const useOrgDonations = (orgId?: string) =>
  useQuery({ queryKey: ["donations", orgId], queryFn: () => api<Donation[]>(`/donations/?org_id=${orgId}`), enabled: !!orgId });

export const useOrgReport = (orgId?: string, months = 6) =>
  useQuery({ queryKey: ["report", orgId, months], queryFn: () => api<OrgReport>(`/analytics/organization/${orgId}?months=${months}`), enabled: !!orgId });

export const useAvailableDonations = () =>
  useQuery({ queryKey: ["available"], queryFn: () => api<{ organization_verified: boolean; donations: Donation[] }>("/donations/available"), refetchInterval: 60_000 });

export const useClaims = (orgId?: string) =>
  useQuery({ queryKey: ["claims", orgId], queryFn: () => api<Donation[]>(`/claims/organization/${orgId}`), enabled: !!orgId });

export const useDemands = (orgId?: string) =>
  useQuery({ queryKey: ["demands", orgId], queryFn: () => api<Demand[]>(`/demands/?org_id=${orgId}`), enabled: !!orgId });

export const useMyTasks = () => useQuery({ queryKey: ["my-tasks"], queryFn: () => api<PickupTask[]>("/pickups/mine") });

export const useAvailableTasks = () =>
  useQuery({ queryKey: ["available-tasks"], queryFn: () => api<{ profile_complete: boolean; tasks: PickupTask[] }>("/pickups/available"), refetchInterval: 60_000 });

export type PickupInfo = {
  donation_id: string;
  task: null | {
    id: string; status: string; volunteer_name?: string | null; created_at: string;
    picked_up_at?: string | null; delivered_at?: string | null; pickup_code?: string | null; delivery_code?: string | null;
  };
};

export const useDonationPickup = (donationId?: string, enabled = true) =>
  useQuery({ queryKey: ["pickup", donationId], queryFn: () => api<PickupInfo>(`/pickups/donation/${donationId}`), enabled: !!donationId && enabled });

export const useAiStatus = () =>
  useQuery({ queryKey: ["ai-status"], queryFn: () => api<{ listing_assistant: boolean; knowledge_assistant: boolean }>("/ai/status"), staleTime: 5 * 60_000 });

export function totalQuantity(d: Pick<Donation, "food_items">): { qty: number; unit: string } {
  const qty = d.food_items.reduce((s, i) => s + i.quantity, 0);
  return { qty, unit: d.food_items[0]?.unit ?? "meals" };
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
