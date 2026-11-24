"use client";
import { PageHeader } from "@/components/ui/misc";
import { ClaimsList } from "@/components/ngo/claims-list";
import { useMeRequired } from "@/lib/use-me-required";

export default function DistributionPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Distribution records" description="Food received through FoodRescue, confirmed with your delivery code. Export for trustees and donors." />
      <ClaimsList me={me} mode="distribution" />
    </>
  );
}
