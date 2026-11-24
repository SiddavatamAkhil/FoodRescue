"use client";

import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Table, TD, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/status";
import { errorMessage } from "@/lib/api";
import { formatNumber, parseApiDate } from "@/lib/format";
import { useClaims, useDemands } from "@/lib/hooks";
import { categoryLabel } from "@/lib/places";
import { useMeRequired } from "@/lib/use-me-required";

// Maps received items onto requirement categories. Cooked items are split by veg/non-veg;
// other categories can't be inferred from a listing, so they show supply as unknown.
function supplyCategory(isVeg: boolean) { return isVeg ? "cooked_veg" : "cooked_non_veg"; }

export default function ForecastingPage() {
  const me = useMeRequired();
  const org = me.organization!;
  const claims = useClaims(org.id);
  const demands = useDemands(org.id);

  if (claims.isLoading || demands.isLoading) return <><PageHeader title="Demand forecasting" /><Panel><LoadingRows /></Panel></>;
  if (claims.error || demands.error) return <><PageHeader title="Demand forecasting" /><Panel><ErrorState message={errorMessage(claims.error ?? demands.error)} onRetry={() => { claims.refetch(); demands.refetch(); }} /></Panel></>;

  const since = Date.now() - 28 * 86400_000;
  const received: Record<string, Record<string, number>> = {};
  for (const d of claims.data ?? []) {
    if (d.status !== "COMPLETED" || (parseApiDate(d.updated_at)?.getTime() ?? 0) < since) continue;
    for (const i of d.food_items) {
      const c = supplyCategory(i.is_veg);
      received[c] = received[c] ?? {};
      received[c][i.unit] = (received[c][i.unit] ?? 0) + i.quantity;
    }
  }
  const reqs = demands.data ?? [];

  return (
    <>
      <PageHeader title="Demand forecasting" description="Your recorded requirements compared with what FoodRescue has actually delivered to you recently." />
      {!reqs.length ? (
        <Panel><EmptyState icon={TrendingUp} title="Add requirements to see a forecast">Forecasts compare your requirements with deliveries over the past four weeks. Add requirements on the Food requirements page.</EmptyState></Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Requirement vs. weekly supply" description="Supply is the weekly average delivered over the last 4 weeks, in the same unit." />
            <Table>
              <THead columns={[{ label: "Requirement" }, { label: "Needed", className: "text-right" }, { label: "Avg. supplied / week", className: "text-right" }, { label: "Outlook" }]} />
              <tbody>
                {reqs.map((r) => {
                  const weekly = (received[r.food_category]?.[r.unit] ?? 0) / 4;
                  const known = r.food_category.startsWith("cooked_");
                  const cover = r.quantity_needed ? weekly / r.quantity_needed : 0;
                  return (
                    <TR key={r.id}>
                      <TD label="Requirement"><span className="font-semibold">{categoryLabel(r.food_category)}</span> <span className="text-xs text-muted">{r.priority} priority</span></TD>
                      <TD label="Needed" className="md:text-right"><span className="tabular">{formatNumber(r.quantity_needed)} {r.unit}</span></TD>
                      <TD label="Avg. supplied / week" className="md:text-right"><span className="tabular">{known ? `${formatNumber(weekly, 1)} ${r.unit}` : "Not tracked"}</span></TD>
                      <TD label="Outlook">
                        {!known ? <Badge tone="neutral">No category data</Badge> : cover >= 1 ? <Badge tone="success">Likely covered</Badge> : cover >= 0.5 ? <Badge tone="warning">Partly covered</Badge> : <Badge tone="danger">Shortfall expected</Badge>}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </Panel>
          <Panel>
            <PanelBody className="text-sm text-muted">
              Method: deliveries confirmed in the last 28 days, divided by four, compared with each requirement. Listings only record veg or non-veg, so supply is tracked for cooked food categories only.
              To close a shortfall, check <a className="link" href="/dashboard/ngo/available">available donations</a> more often or widen your operating locations.
            </PanelBody>
          </Panel>
        </div>
      )}
    </>
  );
}
