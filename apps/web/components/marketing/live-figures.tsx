"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/feedback";

type Metrics = {
  production_metrics: {
    active_donations_unclaimed: number;
    completed_donations_saved: number;
    expired_donations_unclaimed: number;
    total_registered_organizations: number;
  };
};

/** Live counts from the platform database. Demo records are excluded by the API. */
export function LiveFigures({ detailed = false }: { detailed?: boolean }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-metrics"],
    queryFn: () => api<Metrics>("/analytics/metrics"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-sm text-muted">Live platform figures are unavailable right now.</p>;
  }
  const m = data.production_metrics;
  const total = m.completed_donations_saved + m.active_donations_unclaimed + m.total_registered_organizations;
  if (total === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong p-6">
        <p className="font-semibold">The network is just getting started</p>
        <p className="mt-1 text-sm text-muted">
          Figures appear here as soon as organisations join and the first rescues are confirmed. We don’t publish estimates.
        </p>
      </div>
    );
  }
  const rows = [
    { label: "Rescues completed", value: m.completed_donations_saved, note: "Delivery confirmed by the receiving NGO" },
    { label: "Listings open now", value: m.active_donations_unclaimed, note: "Published and waiting to be claimed" },
    { label: "Organisations registered", value: m.total_registered_organizations, note: "Donors, NGOs and companies" },
    ...(detailed ? [{ label: "Listings that expired", value: m.expired_donations_unclaimed, note: "Closed unclaimed after their pickup deadline" }] : []),
  ];
  return (
    <div>
      <p className="text-sm font-semibold text-muted">Live from the platform</p>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-4">
            <dt className="font-semibold">{r.label}</dt>
            <dd className="row-span-2 text-2xl font-semibold tabular">{formatNumber(r.value)}</dd>
            <dd className="text-sm text-muted">{r.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
