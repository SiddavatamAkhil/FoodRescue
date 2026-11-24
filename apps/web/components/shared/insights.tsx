"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, TrendingUp } from "lucide-react";
import { BarChart, BarList, SERIES } from "@/components/charts/charts";
import { Panel, PanelBody, PanelHeader, StatStrip } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Table, TD, THead, TR } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { formatNumber, formatPercent, monthLabel, parseApiDate } from "@/lib/format";
import { downloadCsv, useOrgReport } from "@/lib/hooks";
import type { Donation, OrgReport } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthsSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Select value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className="h-9 w-40 text-sm" aria-label="Reporting period">
      <option value="3">Last 3 months</option>
      <option value="6">Last 6 months</option>
      <option value="12">Last 12 months</option>
    </Select>
  );
}

function NoData({ what }: { what: string }) {
  return (
    <EmptyState icon={BarChart3} title="Not enough data yet">
      {what} will appear once there are recorded donations in this period. Nothing here is estimated.
    </EmptyState>
  );
}

/** Waste/rescue analytics for a donor or corporate organisation. */
export function WasteAnalytics({ orgId, perspective = "donor" }: { orgId: string; perspective?: "donor" | "recipient" }) {
  const [months, setMonths] = useState(6);
  const { data, isLoading, error, refetch } = useOrgReport(orgId, months);
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><MonthsSelect value={months} onChange={setMonths} /></div>
      {isLoading ? <Panel><LoadingRows /></Panel> : error ? <Panel><ErrorState message={errorMessage(error)} onRetry={refetch} /></Panel> : !data || data.total_listings === 0 ? <Panel><NoData what="Surplus and rescue trends" /></Panel> : (
        <AnalyticsBody r={data} perspective={perspective} />
      )}
    </div>
  );
}

function AnalyticsBody({ r, perspective }: { r: OrgReport; perspective: "donor" | "recipient" }) {
  const unit = r.primary_unit;
  const expired = r.monthly.reduce((s, m) => s + m.expired, 0);
  const recipient = perspective === "recipient";
  return (
    <>
      {recipient ? (
        <StatStrip items={[
          { label: "Claimed", value: <>{formatNumber(r.quantity_listed)} <span className="text-base font-normal text-muted">{unit}</span></>, note: `${r.total_listings} donations` },
          { label: "Received", value: <>{formatNumber(r.quantity_rescued)} <span className="text-base font-normal text-muted">{unit}</span></>, note: "Delivery confirmed" },
          { label: "Completion rate", value: formatPercent(r.completion_rate), note: "Of claims that have closed" },
          { label: "Open requirements", value: <>{formatNumber(r.open_demand_quantity ?? 0)}</>, note: "Total quantity recorded" },
        ]} />
      ) : (
      <StatStrip items={[
        { label: "Surplus listed", value: <>{formatNumber(r.quantity_listed)} <span className="text-base font-normal text-muted">{unit}</span></>, note: `${r.total_listings} listings` },
        { label: "Rescued", value: <>{formatNumber(r.quantity_rescued)} <span className="text-base font-normal text-muted">{unit}</span></>, note: "Delivery confirmed" },
        { label: "Completion rate", value: formatPercent(r.completion_rate), note: "Of listings that have closed" },
        { label: "Expired unclaimed", value: <>{formatNumber(expired)} <span className="text-base font-normal text-muted">{unit}</span></>, note: "Reached deadline without a claim" },
      ]} />
      )}
      <Panel>
        <PanelBody>
          <BarChart
            title={recipient ? `Food claimed and received per month (${unit})` : `Surplus listed and rescued per month (${unit})`}
            unit={unit}
            categories={r.monthly.map((m) => monthLabel(m.month))}
            series={[
              { key: "listed", label: recipient ? "Claimed" : "Listed", color: SERIES.listed, values: r.monthly.map((m) => m.listed) },
              { key: "rescued", label: recipient ? "Received" : "Rescued", color: SERIES.rescued, values: r.monthly.map((m) => m.rescued) },
            ]}
          />
        </PanelBody>
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel><PanelBody>
          <BarList title={recipient ? `Claims by day of week (${unit})` : `Surplus by day of week (${unit})`} unit={unit} color={SERIES.listed} rows={WEEKDAYS.map((d, i) => ({ label: d, value: r.weekday_quantity[i] ?? 0 }))} />
          <p className="mt-4 text-xs text-muted">{recipient ? "Days when most food becomes available to you. Plan volunteer and kitchen capacity around them." : "Days with consistently high surplus are where adjusting preparation quantities saves the most."}</p>
        </PanelBody></Panel>
        <Panel><PanelBody>
          <BarList title={`Veg and non-veg (${unit})`} unit={unit} color={SERIES.listed} rows={[{ label: "Veg", value: r.category_split.veg }, { label: "Non-veg", value: r.category_split.non_veg }]} />
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">Listings by outcome</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {Object.entries(r.by_status).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span className="text-ink-soft">{k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, " ")}</span><span className="font-semibold tabular">{v}</span></li>
              ))}
            </ul>
          </div>
        </PanelBody></Panel>
      </div>
    </>
  );
}

/** Monthly figures as a table, with CSV export. */
export function MonthlyReport({ orgId, filePrefix, rescuedLabel = "Rescued" }: { orgId: string; filePrefix: string; rescuedLabel?: string }) {
  const [months, setMonths] = useState(12);
  const { data, isLoading, error, refetch } = useOrgReport(orgId, months);
  const rows = data ? [...data.monthly].reverse() : [];
  return (
    <Panel>
      <PanelHeader
        title="Monthly summary"
        description="Calculated from recorded donations. Quantities use the units donors entered."
        action={<>
          <MonthsSelect value={months} onChange={setMonths} />
          <Button variant="secondary" size="sm" disabled={!data || data.total_listings === 0} onClick={() =>
            downloadCsv(`${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`, [
              ["Month", "Listings", `Listed (${data!.primary_unit})`, `${rescuedLabel} (${data!.primary_unit})`, `Expired (${data!.primary_unit})`],
              ...data!.monthly.map((m) => [m.month, m.listings, m.listed, m.rescued, m.expired]),
            ])}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
        </>}
      />
      {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : !data || data.total_listings === 0 ? <NoData what="Monthly figures" /> : (
        <Table>
          <THead columns={[{ label: "Month" }, { label: "Listings", className: "text-right" }, { label: "Listed", className: "text-right" }, { label: rescuedLabel, className: "text-right" }, { label: "Expired", className: "text-right" }]} />
          <tbody>
            {rows.map((m) => (
              <TR key={m.month}>
                <TD label="Month"><span className="font-semibold">{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${m.month}-15`))}</span></TD>
                <TD label="Listings" className="md:text-right"><span className="tabular">{m.listings}</span></TD>
                <TD label="Listed" className="md:text-right"><span className="tabular">{formatNumber(m.listed, 1)} {data.primary_unit}</span></TD>
                <TD label={rescuedLabel} className="md:text-right"><span className="tabular">{formatNumber(m.rescued, 1)} {data.primary_unit}</span></TD>
                <TD label="Expired" className="md:text-right"><span className="tabular">{formatNumber(m.expired, 1)} {data.primary_unit}</span></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

/**
 * Weekday surplus forecast: the average quantity listed on each weekday over the last
 * eight weeks that had any listings. Shown only with at least three weeks of history.
 */
export function SurplusForecast({ donations }: { donations: Donation[] }) {
  const result = useMemo(() => {
    const cutoff = Date.now() - 56 * 86400_000;
    const recent = donations.filter((d) => (parseApiDate(d.created_at)?.getTime() ?? 0) >= cutoff && d.status !== "DRAFT");
    const weeks = new Set<string>();
    const totals = Array(7).fill(0);
    const occurrences = Array.from({ length: 7 }, () => new Set<string>());
    let unit = "meals";
    for (const d of recent) {
      const dt = parseApiDate(d.created_at)!;
      const ist = new Date(dt.getTime() + 5.5 * 3600_000);
      const wd = (ist.getUTCDay() + 6) % 7;
      const weekKey = `${ist.getUTCFullYear()}-${Math.floor((ist.getTime() / 86400_000 + 3) / 7)}`;
      weeks.add(weekKey);
      occurrences[wd].add(weekKey);
      const q = d.food_items.reduce((s, i) => s + i.quantity, 0);
      totals[wd] += q;
      unit = d.food_items[0]?.unit ?? unit;
    }
    const weekCount = weeks.size;
    const avg = totals.map((t) => (weekCount ? t / weekCount : 0));
    return { weekCount, avg, unit, listings: recent.length };
  }, [donations]);

  if (result.weekCount < 3) {
    return (
      <Panel>
        <EmptyState icon={TrendingUp} title="Predictions need more history">
          We forecast from your own listings over the past eight weeks. Once you’ve listed surplus in at least three different weeks
          ({result.weekCount} so far), expected surplus by day appears here.
        </EmptyState>
      </Panel>
    );
  }
  const today = (new Date().getDay() + 6) % 7;
  const order = Array.from({ length: 7 }, (_, i) => (today + i) % 7);
  const peak = result.avg.indexOf(Math.max(...result.avg));
  return (
    <div className="space-y-6">
      <Panel>
        <PanelBody>
          <BarList title={`Expected surplus over the next 7 days (${result.unit})`} unit={result.unit} color={SERIES.listed}
            rows={order.map((d, i) => ({ label: i === 0 ? `Today (${WEEKDAYS[d]})` : WEEKDAYS[d], value: Math.round(result.avg[d] * 10) / 10 }))} />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="What to do with this" />
        <PanelBody className="space-y-2 text-sm text-ink-soft">
          <p><strong className="text-ink">{WEEKDAYS[peak]}</strong> is usually your highest-surplus day. Consider preparing slightly less, or arranging a standing pickup with a nearby NGO.</p>
          <p className="text-muted">Method: average quantity listed on each weekday across the {result.weekCount} weeks with listings in the last 8 weeks ({result.listings} listings). It doesn’t account for holidays or events.</p>
        </PanelBody>
      </Panel>
    </div>
  );
}
