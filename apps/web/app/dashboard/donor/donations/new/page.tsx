"use client";
import { PageHeader } from "@/components/ui/misc";
import { DonationForm } from "@/components/shared/donation-form";
import { useMeRequired } from "@/lib/use-me-required";

export default function NewDonationPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Create donation" description="List unserved surplus food for collection." breadcrumbs={[{ label: "My donations", href: "/dashboard/donor/donations" }, { label: "Create donation" }]} />
      <DonationForm me={me} listHref="/dashboard/donor/donations" />
    </>
  );
}
