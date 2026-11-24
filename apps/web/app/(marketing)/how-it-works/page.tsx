import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";
import { CustodyChain } from "@/components/shared/custody-chain";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  { title: "Create an account and get verified", detail: "Choose your account type and complete onboarding. Donors and NGOs upload registration documents; an administrator reviews them. You can explore your workspace while you wait.", state: "done" as const },
  { title: "Donor lists surplus", detail: "Describe what is left over, how much, when it was prepared and the latest time it can be collected. Listings start as drafts and are published once you confirm.", state: "done" as const },
  { title: "Nearby NGOs see it and one claims it", detail: "Verified NGOs within 50 km see the listing with its distance and deadline. Claims are locked at the database level, so exactly one NGO gets it.", state: "done" as const },
  { title: "A volunteer accepts the pickup", detail: "Volunteers see claimed food that needs moving, with pickup and drop-off addresses and directions. The first to accept is assigned.", state: "done" as const },
  { title: "Pickup is confirmed with the donor's code", detail: "At handover the donor shows a pickup code. The volunteer enters or scans it, which records the time and moves the food into transit.", state: "done" as const },
  { title: "Delivery is confirmed with the NGO's code", detail: "On arrival the NGO shows its own delivery code. Entering it completes the rescue and updates everyone's records.", state: "done" as const },
];

const faqs = [
  ["What food can be listed?", "Unserved surplus that was prepared and stored safely: cooked meals that never left the kitchen, bakery items, dry rations, fruit and vegetables, dairy and packaged goods within date. Food from plates or buffets that guests have served themselves from cannot be listed."],
  ["What happens if nobody claims a listing?", "Operations staff are alerted when a listing is within two hours of its deadline. If the deadline passes, the listing closes automatically and is recorded as expired."],
  ["Who can see my address?", "Pickup addresses are visible to verified NGOs browsing listings and to the volunteer assigned to the pickup. They are not shown publicly."],
  ["Does it cost anything?", "Donating, receiving and volunteering are free."],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro title="How a rescue moves from kitchen to community">
        Six steps, each recorded. Anyone involved can see where the food is and who has it.
      </PageIntro>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-[1.2fr_0.8fr]">
        <CustodyChain steps={steps} />
        <aside className="h-fit rounded-md border border-line bg-surface p-6">
          <h2 className="font-semibold">Ready to take part?</h2>
          <p className="mt-1 text-sm text-muted">Pick the account type that matches what you do. You can’t change it later, so choose the one for your organisation.</p>
          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink href="/signup?type=DONOR">Sign up as a food donor</ButtonLink>
            <ButtonLink href="/signup?type=RECIPIENT" variant="secondary">Sign up as an NGO</ButtonLink>
            <ButtonLink href="/signup?type=VOLUNTEER" variant="secondary">Sign up as a volunteer</ButtonLink>
          </div>
        </aside>
      </section>
      <section id="food-safety" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-semibold">Food safety rules</h2>
          <p className="mt-2 max-w-prose text-muted">
            These rules follow the Food Safety and Standards (Recovery and Distribution of Surplus Food) Regulations, 2019.
            The platform enforces them; it does not replace your own food safety obligations.
          </p>
          <ul className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {[
              ["Only unserved food", "Anything that has been on a plate or self-served by guests is refused at listing time, including by the listing assistant."],
              ["Correct storage until pickup", "Keep hot food hot and cold food cold. Record storage instructions on the listing so the volunteer can follow them."],
              ["Clear times", "Preparation time, expiry time and pickup deadline are required for every item. Food is never shown after its deadline."],
              ["Licensed participants", "Donors provide their FSSAI registration or licence number; NGOs provide their registration details. Both are checked before publishing or claiming."],
            ].map(([t, b]) => (
              <li key={t} className="border-t border-line pt-4">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-semibold">Common questions</h2>
        <dl className="mt-6 max-w-3xl divide-y divide-line border-y border-line">
          {faqs.map(([q, a]) => (
            <div key={q} className="py-5">
              <dt className="font-semibold">{q}</dt>
              <dd className="mt-1.5 text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
