import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "For restaurants and food businesses" };

const blocks = [
  ["List in the moment", "Close of service, a cancelled event, an over-prepared buffet tray that never went out: record it as soon as you know. Add items, quantities and the latest pickup time. If a language model is configured for your platform, you can describe the surplus in a sentence and the form is filled in for you to check."],
  ["Know who is coming", "When an NGO claims your listing you are notified, and you can see which volunteer has accepted the pickup. At handover, show your pickup code from the Pickup tracking page."],
  ["One record per rescue", "Every listing keeps its full history: when it was published, claimed, collected and delivered, and by whom. Export it for your own audits."],
  ["See your surplus patterns", "Waste analytics show how much you list and how much is actually rescued each month, and which days of the week produce the most surplus, so you can adjust preparation."],
  ["Multiple branches", "Record each outlet's address and contact so listings can be raised from the right location."],
];

export default function ForRestaurantsPage() {
  return (
    <>
      <PageIntro
        title="Turn tonight's surplus into tomorrow's meals"
        aside={<div className="flex flex-col gap-2 sm:flex-row md:flex-col"><ButtonLink href="/signup?type=DONOR" size="lg">Sign up as a food donor</ButtonLink><ButtonLink href="/signup?type=CORPORATE" variant="secondary" size="lg">Sign up as a company</ButtonLink></div>}
      >
        For restaurants, caterers, hotels, canteens and event venues with safe, unserved food left at the end of service.
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
            <li className="rounded-md border border-line p-4"><strong className="block text-ink">FSSAI registration or licence</strong>The 14-digit number and a copy of the certificate.</li>
            <li className="rounded-md border border-line p-4"><strong className="block text-ink">Business address</strong>Where food will be collected, with the city.</li>
            <li className="rounded-md border border-line p-4"><strong className="block text-ink">A contact for pickups</strong>Name and phone number of the person on site.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
