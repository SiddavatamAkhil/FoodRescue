"use client";
import { PageHeader } from "@/components/ui/misc";
import { OrgTable } from "@/components/admin/org-table";

export default function VerificationPage() {
  return (<><PageHeader title="Verification requests" description="Check registration details and documents. Organisations can't publish or claim until verified." /><OrgTable queue /></>);
}
