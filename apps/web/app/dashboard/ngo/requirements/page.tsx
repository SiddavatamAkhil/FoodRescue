"use client";
import { PageHeader } from "@/components/ui/misc";
import { Requirements } from "@/components/ngo/requirements";
import { useMeRequired } from "@/lib/use-me-required";

export default function RequirementsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Food requirements" description="What your organisation needs on a regular basis." />
      <Requirements me={me} />
    </>
  );
}
