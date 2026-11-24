"use client";

import { PageHeader } from "@/components/ui/misc";
import { KeyValue, Panel, PanelBody, PanelHeader, StatStrip } from "@/components/ui/panel";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";
import { useOrgDonations, useOrgReport } from "@/lib/hooks";
import { useMeRequired } from "@/lib/use-me-required";

export default function CsrPage() {
  const me = useMeRequired();
  const org = me.organization!;
  const report = useOrgReport(org.id, 12);
  const donations = useOrgDonations(org.id);
  if (report.isLoading || donations.isLoading) return <><PageHeader title="CSR performance" /><Panel><LoadingRows /></Panel></>;
  if (report.error || donations.error) return <><PageHeader title="CSR performance" /><Panel><ErrorState message={errorMessage(report.error ?? donations.error)} onRetry={() => { report.refetch(); donations.refetch(); }} /></Panel></>;
  const r = report.data!;
  const completed = (donations.data ?? []).filter((d) => d.status === "COMPLETED");
  const ngos = new Set(completed.map((d) => d.claimed_by_org_id).filter(Boolean));
  const branches = org.profile.branches?.length ?? 0;
  return (
    <>
      <PageHeader title="CSR performance" description="Your company's food rescue contribution over the last 12 months." />
      <div className="space-y-6">
        <StatStrip items={[
          { label: "Food rescued", value: <>{formatNumber(r.quantity_rescued)} <span className="text-base font-normal text-muted">{r.primary_unit}</span></>, note: "Last 12 months" },
          { label: "Rescues completed", value: completed.length, note: "Delivery confirmed" },
          { label: "NGOs supported", value: ngos.size, note: "Distinct receiving organisations" },
          { label: "Completion rate", value: formatPercent(r.completion_rate), note: "Of listings that closed" },
        ]} />
        <Panel>
          <PanelHeader title="Programme summary" />
          <PanelBody>
            <KeyValue items={[
              { label: "Company", value: org.name },
              { label: "Representative", value: `${org.profile.representative_name ?? "—"}${org.profile.representative_designation ? `, ${org.profile.representative_designation}` : ""}` },
              { label: "Participating sites", value: `${branches + 1} (main office${branches ? ` and ${branches} branch${branches > 1 ? "es" : ""}` : ""})` },
              { label: "Listings raised", value: r.total_listings },
              { label: "Food listed", value: `${formatNumber(r.quantity_listed)} ${r.primary_unit}` },
            ]} />
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
