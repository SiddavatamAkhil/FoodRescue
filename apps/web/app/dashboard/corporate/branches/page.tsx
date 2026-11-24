"use client";
import { PageHeader } from "@/components/ui/misc";
import { BranchManager } from "@/components/shared/settings";
import { useMeRequired } from "@/lib/use-me-required";

export default function CorporateBranchesPage() {
  const me = useMeRequired();
  return (<><PageHeader title="Branches" description="Sites that donate surplus under your company account." /><BranchManager me={me} /></>);
}
