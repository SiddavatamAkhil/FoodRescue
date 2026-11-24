"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { StatStrip } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/feedback";
import { ActiveAssignments, AvailableTasks } from "@/components/volunteer/tasks";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useAvailableTasks } from "@/lib/hooks";
import { useMeRequired } from "@/lib/use-me-required";

export default function VolunteerOverview() {
  const me = useMeRequired();
  const available = useAvailableTasks();
  const stats = useQuery({ queryKey: ["vol-stats"], queryFn: () => api<{ delivered: number; in_progress: number; quantity_delivered: number }>("/analytics/volunteer") });
  const origin = me.volunteer ? { lat: me.volunteer.latitude, lng: me.volunteer.longitude } : null;
  const days = me.volunteer?.availability.days?.map((d) => d[0].toUpperCase() + d.slice(1)).join(", ");

  return (
    <>
      <PageHeader
        title="Overview"
        description={me.volunteer ? <>Usually available {days}, {me.volunteer.availability.from}–{me.volunteer.availability.to}. <Link href="/dashboard/volunteer/availability" className="link">Change</Link></> : undefined}
      />
      <div className="space-y-6">
        {stats.isLoading || available.isLoading ? <Skeleton className="h-24 w-full" /> : (
          <StatStrip items={[
            { label: "Pickups needing a volunteer", value: available.data?.tasks.length ?? 0, note: "Claimed, nobody assigned" },
            { label: "Your active pickups", value: stats.data?.in_progress ?? 0, note: "Accepted, not yet delivered" },
            { label: "Deliveries completed", value: stats.data?.delivered ?? 0, note: "Confirmed by the NGO" },
            { label: "Food delivered", value: formatNumber(stats.data?.quantity_delivered ?? 0), note: "Total quantity, all units" },
          ]} />
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-md font-semibold">Your assignments</h2>
            <ActiveAssignments origin={origin} />
          </section>
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-md font-semibold">Available near you</h2>
              <Link href="/dashboard/volunteer/tasks" className="text-sm font-semibold text-forest hover:underline">All tasks</Link>
            </div>
            <AvailableTasks limit={3} />
          </section>
        </div>
      </div>
    </>
  );
}
