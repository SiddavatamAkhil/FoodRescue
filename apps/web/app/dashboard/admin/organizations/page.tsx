"use client";
import { PageHeader } from "@/components/ui/misc";
import { OrgTable } from "@/components/admin/org-table";

export default function OrganizationsPage() {
  return (<><PageHeader title="Organizations" description="Every registered donor, NGO and company." /><OrgTable /></>);
}
