"use client";
import { PageHeader } from "@/components/ui/misc";
import { PickupTracking } from "@/components/shared/pickup-tracking";
import { useMeRequired } from "@/lib/use-me-required";

export default function PickupsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Pickup tracking" description="Claimed donations on their way to an NGO. Hand food over only after the volunteer enters your pickup code." />
      <PickupTracking me={me} />
    </>
  );
}
