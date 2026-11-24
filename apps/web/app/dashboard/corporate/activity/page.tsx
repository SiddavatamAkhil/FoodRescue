"use client";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { DonationsTable } from "@/components/shared/donations-table";
import { useMeRequired } from "@/lib/use-me-required";

export default function ActivityPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Food rescue activity" description="Every donation raised by your company, across branches." actions={<ButtonLink href="/dashboard/corporate/donations/new"><Plus className="h-4 w-4" aria-hidden /> Create donation</ButtonLink>} />
      <DonationsTable me={me} createHref="/dashboard/corporate/donations/new" />
    </>
  );
}
