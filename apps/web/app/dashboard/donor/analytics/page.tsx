"use client";
import { PageHeader } from "@/components/ui/misc";
import { WasteAnalytics } from "@/components/shared/insights";
import { useMeRequired } from "@/lib/use-me-required";

export default function DonorAnalyticsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Waste analytics" description="How much surplus you list, how much is rescued, and when it happens." />
      <WasteAnalytics orgId={me.organization!.id} />
    </>
  );
}
