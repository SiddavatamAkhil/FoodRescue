"use client";
import { PageHeader } from "@/components/ui/misc";
import { MonthlyReport, WasteAnalytics } from "@/components/shared/insights";
import { useMeRequired } from "@/lib/use-me-required";

export default function ImpactReportsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Impact reports" description="Food your organisation received through FoodRescue." />
      <div className="space-y-6">
        <WasteAnalytics orgId={me.organization!.id} perspective="recipient" />
        <MonthlyReport orgId={me.organization!.id} filePrefix="foodrescue-impact-report" rescuedLabel="Received" />
      </div>
    </>
  );
}
