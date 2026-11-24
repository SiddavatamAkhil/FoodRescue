export type Role = "DONOR" | "RECIPIENT" | "VOLUNTEER" | "CORPORATE" | "ADMIN" | "OPS_MANAGER";
export type VerificationStatus = "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "INFO_REQUIRED" | "SUSPENDED";
export type DonationStatus =
  | "DRAFT" | "PUBLISHED" | "MATCHING" | "CLAIMED" | "PICKUP_ASSIGNED" | "PICKED_UP"
  | "DELIVERED" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "DISPUTED" | "FAILED";

export interface Branch { name: string; address: string; contact_phone?: string | null }

export interface Organization {
  id: string;
  name: string;
  type: "DONOR" | "RECIPIENT" | "CORPORATE";
  verification_status: VerificationStatus;
  verification_notes?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  daily_capacity?: number | null;
  fssai_number?: string | null;
  ngo_darpan_id?: string | null;
  profile: Record<string, unknown> & { branches?: Branch[]; food_categories?: string[] };
}

export interface VolunteerProfile {
  id: string;
  vehicle_type?: string | null;
  vehicle_capacity?: number | null;
  service_area?: string | null;
  availability: { days?: string[]; from?: string; to?: string };
  is_available: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Me {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string | null;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
  profile: Record<string, unknown>;
  organization: Organization | null;
  volunteer: VolunteerProfile | null;
  phone_verification_available: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  is_veg: boolean;
  prep_time: string;
  expiry_time: string;
  is_leftover: boolean;
}

export interface Donation {
  id: string;
  organization_id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  status: DonationStatus;
  latitude: number;
  longitude: number;
  pickup_address: string;
  pickup_deadline: string;
  storage_info?: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  food_items: FoodItem[];
  claimed_by_org_id?: string | null;
  state_history?: { status: string; timestamp: string }[];
  distance_km?: number;
  donor_name?: string | null;
  pickup?: { status: string; picked_up_at?: string | null; delivered_at?: string | null; delivery_token?: string | null } | null;
}

export interface PickupTask {
  task_id: string;
  status: "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED" | "CANCELLED";
  created_at: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  donation_id: string;
  title: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_deadline: string;
  donor_name?: string | null;
  dropoff_name?: string | null;
  dropoff_address?: string | null;
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
  quantity: number;
  unit?: string | null;
  distance_km?: number | null;
}

export interface Demand {
  id: string;
  organization_id: string;
  food_category: string;
  quantity_needed: number;
  unit: string;
  priority: "low" | "medium" | "high";
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface MonthlyPoint { month: string; listed: number; rescued: number; expired: number; listings: number }

export interface OrgReport {
  total_listings: number;
  by_status: Record<string, number>;
  active: number;
  completed: number;
  completion_rate: number | null;
  quantity_listed: number;
  quantity_rescued: number;
  monthly: MonthlyPoint[];
  category_split: { veg: number; non_veg: number };
  weekday_quantity: number[];
  primary_unit: string;
  organization_type?: string;
  open_demand_quantity?: number;
  daily_capacity?: number | null;
}

export interface Notification { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string }

export interface Paged<T> { total: number; items: T[] }
