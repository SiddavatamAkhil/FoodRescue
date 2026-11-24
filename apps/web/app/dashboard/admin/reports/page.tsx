"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, StatStrip } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { BarChart, SERIES } from "@/components/charts/charts";
import { MonthsSelect } from "@/components/shared/insights";
import { api, errorMessage } from "@/lib/api";
import { formatNumber, formatPercent, monthLabel } from "@/lib/format";
import { downloadCsv } from "@/lib/hooks";
import type { OrgReport } from "@/lib/types";

export default function AdminReportsPage() {
  const [months, setMonths] = useState(6);
  const { data: r, isLoading, error, refetch } = useQuery({ queryKey: ["platform-report", months], queryFn: () => api<OrgReport>(`/analytics/platform?months=${months}`) });
  return (
    <>
      <PageHeader title="Reports" description="Platform-wide figures from recorded donations. Demo records are excluded." actions={<>
        <MonthsSelect value={months} onChange={setMonths} />
        <Button variant="secondary" disabled={!r?.total_listings} onClick={() => downloadCsv(`foodrescue-platform-${new Date().toISOString().slice(0, 10)}.csv`, [["Month", "Listings", "Listed", "Rescued", "Expired"], ...r!.monthly.map((m) => [m.month, m.listings, m.listed, m.rescued, m.expired])])}>
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </Button>
      </>} />
      {isLoading ? <Panel><LoadingRows /></Panel> : error ? <Panel><ErrorState message={errorMessage(error)} onRetry={refetch} /></Panel> : !r?.total_listings ? (
        <Panel><EmptyState icon={BarChart3} title="No donations recorded yet">Platform reports fill in as donors publish listings.</EmptyState></Panel>
      ) : (
        <div className="space-y-6">
          <StatStrip items={[
            { label: "Listings", value: formatNumber(r.total_listings) },
            { label: "Quantity listed", value: formatNumber(r.quantity_listed), note: "All units combined" },
            { label: "Quantity rescued", value: formatNumber(r.quantity_rescued), note: "Delivery confirmed" },
            { label: "Completion rate", value: formatPercent(r.completion_rate), note: "Of closed listings" },
          ]} />
          <Panel><PanelBody>
            <BarChart title="Quantity listed and rescued per month" unit="units" categories={r.monthly.map((m) => monthLabel(m.month))}
              series={[
                { key: "listed", label: "Listed", color: SERIES.listed, values: r.monthly.map((m) => m.listed) },
                { key: "rescued", label: "Rescued", color: SERIES.rescued, values: r.monthly.map((m) => m.rescued) },
              ]} />
          </PanelBody></Panel>
        </div>
      )}
    </>
  );
}
