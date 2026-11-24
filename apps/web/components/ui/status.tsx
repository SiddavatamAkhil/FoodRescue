import { cn } from "@/lib/cn";
import type { DonationStatus, VerificationStatus } from "@/lib/types";

type Tone = "neutral" | "forest" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line",
  forest: "bg-forest-50 text-forest border-forest-100",
  success: "bg-success-50 text-success-text border-success/20",
  warning: "bg-warning-50 text-warning-text border-warning/25",
  danger: "bg-danger-50 text-danger-text border-danger/20",
  info: "bg-info-50 text-info border-info/20",
};
const dots: Record<Tone, string> = {
  neutral: "bg-muted", forest: "bg-forest", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info",
};

export function Badge({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export const DONATION_STATUS: Record<DonationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Open for claims", tone: "forest" },
  MATCHING: { label: "Matching", tone: "forest" },
  CLAIMED: { label: "Claimed", tone: "info" },
  PICKUP_ASSIGNED: { label: "Volunteer assigned", tone: "info" },
  PICKED_UP: { label: "In transit", tone: "warning" },
  DELIVERED: { label: "Delivered", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "danger" },
  DISPUTED: { label: "Disputed", tone: "danger" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function DonationStatusBadge({ status }: { status: DonationStatus }) {
  const s = DONATION_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const VERIFICATION: Record<VerificationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  INFO_REQUIRED: { label: "Information required", tone: "warning" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const s = VERIFICATION[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  ASSIGNED: { label: "To collect", tone: "info" },
  PICKED_UP: { label: "In transit", tone: "warning" },
  DELIVERED: { label: "Delivered", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};
