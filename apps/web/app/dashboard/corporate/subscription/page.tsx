"use client";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export default function SubscriptionPage() {
  return (
    <>
      <PageHeader title="Subscription" />
      <Panel>
        <EmptyState icon={CreditCard} title="Billing isn't available yet" action={<ButtonLink href="/contact" variant="secondary">Contact the FoodRescue team</ButtonLink>}>
          Your company account has full access to donations, branches and reporting at no cost. Paid plans haven’t been launched, so there’s nothing to manage here.
        </EmptyState>
      </Panel>
    </>
  );
}
