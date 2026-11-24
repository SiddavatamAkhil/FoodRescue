import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "For NGOs and food banks" };

const blocks = [
  ["Surplus near your kitchens", "Available donations are listed nearest first, with the donor, quantity, veg or non-veg, and how long is left before the pickup deadline."],
  ["Claim what you can serve", "Set your daily meal capacity during onboarding. Claims that would take you over it are declined, so food goes to someone who can use it today."],
  ["Post your requirements", "Record standing needs such as dry rations for 200 people a week. They inform matching and show up in your demand forecast."],
  ["Track every delivery", "Incoming deliveries show the assigned volunteer and status. Hand them your delivery code when the food arrives to close the rescue."],
  ["Records for your reports", "Distribution records and impact reports are built from confirmed deliveries and can be exported as CSV for donors and trustees."],
];

export default function ForNgosPage() {
  return (
    <>
      <PageIntro title="Reliable food supply for the people you serve" aside={<ButtonLink href="/signup?type=RECIPIENT" size="lg">Sign up as an NGO</ButtonLink>}>
        For registered NGOs, trusts, shelters, community kitchens and food banks.
      </PageIntro>
      <section className="mx-auto max-w-6xl px-5 py-14">
        <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {blocks.map(([t, b]) => (
            <div key={t} className="border-t border-line pt-5">
              <dt className="text-lg font-semibold">{t}</dt>
              <dd className="mt-2 text-muted">{b}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-xl font-semibold">What you’ll need to get verified</h2>
          <ul className="mt-4 grid gap-3 text-ink-soft md:grid-cols-3">
            <li className="rounded-md border border-line p-4"><strong className="block text-ink">Registration details</strong>NGO Darpan ID, trust deed or society registration number, with a copy.</li>
            <li className="rounded-md border border-line p-4"><strong className="block text-ink">FSSAI registration</strong>If your kitchen or food bank holds one.</li>
            <li className="rounded-md border border-line p-4"><strong className="block text-ink">Daily capacity</strong>How many meals you can safely receive and serve in a day.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
