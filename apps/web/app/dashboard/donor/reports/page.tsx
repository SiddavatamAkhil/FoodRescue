"use client";
import { PageHeader } from "@/components/ui/misc";
import { MonthlyReport } from "@/components/shared/insights";
import { useMeRequired } from "@/lib/use-me-required";

export default function DonorReportsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Reports" description="Monthly figures for your records, audits or management reporting." />
      <MonthlyReport orgId={me.organization!.id} filePrefix="foodrescue-donor-report" />
    </>
  );
}
