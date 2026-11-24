"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Me, Role } from "./types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), staleTime: 60_000 });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login?signed_out=1";
}

export const ROLE_HOME: Record<Role, string> = {
  DONOR: "/dashboard/donor",
  RECIPIENT: "/dashboard/ngo",
  VOLUNTEER: "/dashboard/volunteer",
  CORPORATE: "/dashboard/corporate",
  ADMIN: "/dashboard/admin",
  OPS_MANAGER: "/dashboard/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  DONOR: "Food donor",
  RECIPIENT: "NGO / food bank",
  VOLUNTEER: "Volunteer",
  CORPORATE: "Corporate",
  ADMIN: "Administrator",
  OPS_MANAGER: "Operations manager",
};

/** Where a signed-in user should land. */
export function homeFor(me: Pick<Me, "role" | "onboarding_completed">): string {
  if (!me.onboarding_completed && !["ADMIN", "OPS_MANAGER"].includes(me.role)) return "/onboarding";
  return ROLE_HOME[me.role];
}
