"use client";
import { PageHeader } from "@/components/ui/misc";
import { AdminDonationTable } from "@/components/admin/donation-table";

export default function OperationsPage() {
  return (
    <>
      <PageHeader title="Rescue operations" description="Live rescues by stage. Refreshes every minute." />
      <div className="space-y-6">
        <AdminDonationTable fixedStatus="PUBLISHED" title="Open, waiting for a claim" emptyText="No open listings" pageSize={10} />
        <AdminDonationTable fixedStatus="CLAIMED" title="Claimed, waiting for a volunteer" emptyText="Every claimed donation has a volunteer" pageSize={10} />
        <AdminDonationTable fixedStatus="PICKUP_ASSIGNED" title="Volunteer heading to donor" emptyText="No pickups in progress" pageSize={10} />
        <AdminDonationTable fixedStatus="PICKED_UP" title="In transit to NGO" emptyText="Nothing in transit" pageSize={10} />
      </div>
    </>
  );
}
