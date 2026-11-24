"use client";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { SurplusForecast } from "@/components/shared/insights";
import { errorMessage } from "@/lib/api";
import { useOrgDonations } from "@/lib/hooks";
import { useMeRequired } from "@/lib/use-me-required";

export default function PredictionsPage() {
  const me = useMeRequired();
  const { data, isLoading, error, refetch } = useOrgDonations(me.organization!.id);
  return (
    <>
      <PageHeader title="Surplus predictions" description="Expected surplus for the coming week, based on your own listing history." />
      {isLoading ? <Panel><LoadingRows /></Panel> : error ? <Panel><ErrorState message={errorMessage(error)} onRetry={refetch} /></Panel> : <SurplusForecast donations={data ?? []} />}
    </>
  );
}
