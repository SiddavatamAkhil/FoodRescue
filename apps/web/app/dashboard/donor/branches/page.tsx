"use client";
import { PageHeader } from "@/components/ui/misc";
import { BranchManager } from "@/components/shared/settings";
import { useMeRequired } from "@/lib/use-me-required";

export default function DonorBranchesPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Branch management" description="Outlets you donate from." />
      <BranchManager me={me} />
    </>
  );
}
