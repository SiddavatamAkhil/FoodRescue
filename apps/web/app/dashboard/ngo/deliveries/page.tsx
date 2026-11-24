"use client";
import { PageHeader } from "@/components/ui/misc";
import { IncomingDeliveries } from "@/components/ngo/claims-list";
import { useMeRequired } from "@/lib/use-me-required";

export default function DeliveriesPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Incoming deliveries" description="Give the volunteer your delivery code only once the food is in your hands." />
      <IncomingDeliveries me={me} />
    </>
  );
}
