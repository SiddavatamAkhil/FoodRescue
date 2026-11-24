import type { VerificationStatus } from "@/lib/types";

export type AdminOrg = {
  id: string; name: string; type: "DONOR" | "RECIPIENT" | "CORPORATE"; verification_status: VerificationStatus;
  verification_notes?: string | null; address: string; fssai_number?: string | null; ngo_darpan_id?: string | null;
  daily_capacity?: number | null; profile: Record<string, unknown>; is_demo: boolean; created_at: string;
  documents: { id: string; document_type: string; status: string; created_at: string }[];
};
export type AdminUser = {
  id: string; email: string; full_name: string; role: string; phone?: string | null; is_active: boolean;
  email_verified: boolean; onboarding_completed: boolean; created_at: string; last_login_at?: string | null;
};
export type AdminDonation = {
  id: string; title: string; status: string; pickup_address: string; pickup_deadline: string; created_at: string;
  is_demo: boolean; donor_name?: string | null; claimed_by_org_id?: string | null; quantity: number; unit?: string | null;
};
export type Incident = {
  id: string; donation_id?: string | null; category: string; description: string; status: "OPEN" | "INVESTIGATING" | "RESOLVED";
  resolution_notes?: string | null; created_at: string; updated_at: string; reporter_email?: string | null;
};

export const ORG_TYPE_LABEL = { DONOR: "Food donor", RECIPIENT: "NGO / food bank", CORPORATE: "Corporate" } as const;
export const INCIDENT_CATEGORY: Record<string, string> = {
  food_safety: "Food safety", no_show: "No-show", quantity_mismatch: "Quantity mismatch", packaging: "Packaging", other: "Other",
};
