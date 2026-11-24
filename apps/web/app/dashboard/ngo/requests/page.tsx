"use client";
import { PageHeader } from "@/components/ui/misc";
import { ClaimsList } from "@/components/ngo/claims-list";
import { useMeRequired } from "@/lib/use-me-required";

export default function RequestsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="My requests" description="Every donation you've claimed and where it is now." />
      <ClaimsList me={me} mode="requests" />
    </>
  );
}
