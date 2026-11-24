"use client";
import { DonorOverview } from "@/components/shared/donor-overview";
import { useMeRequired } from "@/lib/use-me-required";

export default function DonorOverviewPage() {
  const me = useMeRequired();
  return <DonorOverview me={me} base="/dashboard/donor" />;
}
