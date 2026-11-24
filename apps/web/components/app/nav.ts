import {
  BarChart3, Bell, Boxes, Building, CalendarClock, ClipboardCheck, ClipboardList, CreditCard, FileBarChart,
  FileSearch, FileText, Gauge, HandHeart, History, Inbox, LayoutDashboard, Leaf, ListChecks, MapPinned,
  PackageOpen, PlusCircle, QrCode, Route, Scale, Settings, ShieldAlert, ShieldCheck, Sliders, Sprout, Store,
  TrendingUp, Truck, UserCircle, Users, type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

const d = "/dashboard";

export const NAV: Record<"donor" | "ngo" | "volunteer" | "admin" | "corporate", NavGroup[]> = {
  donor: [
    { items: [
      { label: "Overview", href: `${d}/donor`, icon: LayoutDashboard, exact: true },
      { label: "Create donation", href: `${d}/donor/donations/new`, icon: PlusCircle, exact: true },
      { label: "My donations", href: `${d}/donor/donations`, icon: ClipboardList },
      { label: "Pickup tracking", href: `${d}/donor/pickups`, icon: Truck },
      { label: "Food inventory", href: `${d}/donor/inventory`, icon: Boxes },
    ] },
    { label: "Insights", items: [
      { label: "Surplus predictions", href: `${d}/donor/predictions`, icon: TrendingUp },
      { label: "Waste analytics", href: `${d}/donor/analytics`, icon: BarChart3 },
      { label: "Reports", href: `${d}/donor/reports`, icon: FileBarChart },
    ] },
    { label: "Organisation", items: [
      { label: "Branch management", href: `${d}/donor/branches`, icon: Store },
      { label: "Settings", href: `${d}/donor/settings`, icon: Settings },
    ] },
  ],
  ngo: [
    { items: [
      { label: "Overview", href: `${d}/ngo`, icon: LayoutDashboard, exact: true },
      { label: "Available donations", href: `${d}/ngo/available`, icon: PackageOpen },
      { label: "My requests", href: `${d}/ngo/requests`, icon: ClipboardList },
      { label: "Food requirements", href: `${d}/ngo/requirements`, icon: ListChecks },
      { label: "Inventory", href: `${d}/ngo/inventory`, icon: Boxes },
      { label: "Incoming deliveries", href: `${d}/ngo/deliveries`, icon: Truck },
      { label: "Distribution records", href: `${d}/ngo/distribution`, icon: HandHeart },
    ] },
    { label: "Insights", items: [
      { label: "Demand forecasting", href: `${d}/ngo/forecasting`, icon: TrendingUp },
      { label: "Impact reports", href: `${d}/ngo/impact`, icon: FileBarChart },
    ] },
    { label: "Organisation", items: [{ label: "Settings", href: `${d}/ngo/settings`, icon: Settings }] },
  ],
  volunteer: [
    { items: [
      { label: "Overview", href: `${d}/volunteer`, icon: LayoutDashboard, exact: true },
      { label: "Available tasks", href: `${d}/volunteer/tasks`, icon: Inbox },
      { label: "My assignments", href: `${d}/volunteer/assignments`, icon: ClipboardCheck },
      { label: "Route navigation", href: `${d}/volunteer/route`, icon: Route },
      { label: "Pickup verification", href: `${d}/volunteer/verify`, icon: QrCode },
      { label: "Delivery history", href: `${d}/volunteer/history`, icon: History },
    ] },
    { label: "Account", items: [
      { label: "Availability", href: `${d}/volunteer/availability`, icon: CalendarClock },
      { label: "Profile", href: `${d}/volunteer/profile`, icon: UserCircle },
    ] },
  ],
  admin: [
    { items: [
      { label: "Overview", href: `${d}/admin`, icon: Gauge, exact: true },
      { label: "Verification requests", href: `${d}/admin/verification`, icon: ShieldCheck },
      { label: "Rescue operations", href: `${d}/admin/operations`, icon: MapPinned },
      { label: "Incidents", href: `${d}/admin/incidents`, icon: ShieldAlert },
    ] },
    { label: "Records", items: [
      { label: "Users", href: `${d}/admin/users`, icon: Users },
      { label: "Organizations", href: `${d}/admin/organizations`, icon: Building },
      { label: "Donations", href: `${d}/admin/donations`, icon: ClipboardList },
      { label: "Audit logs", href: `${d}/admin/audit-logs`, icon: FileSearch },
    ] },
    { label: "Compliance", items: [
      { label: "Food safety", href: `${d}/admin/food-safety`, icon: Scale },
      { label: "Reports", href: `${d}/admin/reports`, icon: FileBarChart },
      { label: "System settings", href: `${d}/admin/settings`, icon: Sliders },
    ] },
  ],
  corporate: [
    { items: [
      { label: "Overview", href: `${d}/corporate`, icon: LayoutDashboard, exact: true },
      { label: "Branches", href: `${d}/corporate/branches`, icon: Store },
      { label: "Food rescue activity", href: `${d}/corporate/activity`, icon: Sprout },
    ] },
    { label: "Reporting", items: [
      { label: "Waste analytics", href: `${d}/corporate/analytics`, icon: BarChart3 },
      { label: "Sustainability reports", href: `${d}/corporate/sustainability`, icon: Leaf },
      { label: "CSR performance", href: `${d}/corporate/csr`, icon: FileText },
    ] },
    { label: "Account", items: [
      { label: "Subscription", href: `${d}/corporate/subscription`, icon: CreditCard },
      { label: "Settings", href: `${d}/corporate/settings`, icon: Settings },
    ] },
  ],
};

export const ROLE_SECTION: Record<Role, keyof typeof NAV> = {
  DONOR: "donor", RECIPIENT: "ngo", VOLUNTEER: "volunteer", CORPORATE: "corporate", ADMIN: "admin", OPS_MANAGER: "admin",
};

export { Bell };
