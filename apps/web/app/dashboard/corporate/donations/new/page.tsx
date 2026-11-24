"use client";
import { PageHeader } from "@/components/ui/misc";
import { DonationForm } from "@/components/shared/donation-form";
import { useMeRequired } from "@/lib/use-me-required";

export default function CorporateNewDonation() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Create donation" breadcrumbs={[{ label: "Food rescue activity", href: "/dashboard/corporate/activity" }, { label: "Create donation" }]} />
      <DonationForm me={me} listHref="/dashboard/corporate/activity" />
    </>
  );
}
