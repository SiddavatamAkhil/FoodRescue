"use client";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { DonationsTable } from "@/components/shared/donations-table";
import { useMeRequired } from "@/lib/use-me-required";

export default function MyDonationsPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="My donations" description="Every listing from draft to delivery." actions={<ButtonLink href="/dashboard/donor/donations/new"><Plus className="h-4 w-4" aria-hidden /> Create donation</ButtonLink>} />
      <DonationsTable me={me} createHref="/dashboard/donor/donations/new" />
    </>
  );
}
