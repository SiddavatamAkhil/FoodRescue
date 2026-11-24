"use client";
import { PageHeader } from "@/components/ui/misc";
import { AdminDonationTable } from "@/components/admin/donation-table";

export default function AdminDonationsPage() {
  return (<><PageHeader title="Donations" description="Every listing on the platform." /><AdminDonationTable /></>);
}
