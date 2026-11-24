"use client";
import { DonorOverview } from "@/components/shared/donor-overview";
import { useMeRequired } from "@/lib/use-me-required";

export default function CorporateOverview() {
  const me = useMeRequired();
  return <DonorOverview me={me} base="/dashboard/corporate" listPath="activity" showPredictions={false} />;
}
