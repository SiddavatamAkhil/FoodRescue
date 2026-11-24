"use client";
import { PageHeader } from "@/components/ui/misc";
import { AvailableList } from "@/components/ngo/available-list";
import { useMeRequired } from "@/lib/use-me-required";

export default function AvailablePage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Available donations" description="Published surplus within 50 km of your address, soonest deadline first." />
      <AvailableList me={me} />
    </>
  );
}
