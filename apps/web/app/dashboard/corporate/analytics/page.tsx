"use client";
import { PageHeader } from "@/components/ui/misc";
import { WasteAnalytics } from "@/components/shared/insights";
import { useMeRequired } from "@/lib/use-me-required";

export default function CorporateAnalytics() {
  const me = useMeRequired();
  return (<><PageHeader title="Waste analytics" description="Surplus across your sites and how much of it is rescued." /><WasteAnalytics orgId={me.organization!.id} /></>);
}
