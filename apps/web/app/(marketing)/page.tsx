"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, HandHeart, ShieldCheck, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CustodyChain } from "@/components/shared/custody-chain";
import { useMarketingLang } from "@/lib/marketing-i18n";
import { LiveFigures } from "@/components/marketing/live-figures";

const chain = [
  { title: "Listed", detail: "The donor records unserved surplus, quantity and a pickup deadline. Plate leftovers are refused.", state: "done" as const },
  { title: "Matched", detail: "Verified NGOs nearby see the listing, ranked by distance, urgency and capacity.", state: "done" as const },
  { title: "Claimed", detail: "One NGO claims it. The listing locks so it cannot be claimed twice.", state: "done" as const },
  { title: "Collected", detail: "A volunteer enters the donor's pickup code at the handover.", state: "current" as const },
  { title: "Delivered", detail: "The NGO's delivery code confirms arrival and closes the record.", state: "upcoming" as const },
];

const audiences = [
  {
    icon: Building2,
    title: "Restaurants, caterers and hotels",
    points: ["List surplus from your phone or desk", "Know which NGO is collecting and when", "Keep a dated record of every handover"],
    href: "/for-restaurants",
    cta: "How donors use FoodRescue",
  },
  {
    icon: HandHeart,
    title: "NGOs and food banks",
    points: ["See verified surplus near your kitchens", "Claim only what you can serve today", "Post standing food requirements"],
    href: "/for-ngos",
    cta: "How NGOs use FoodRescue",
  },
  {
    icon: Truck,
    title: "Volunteers",
    points: ["Pick up tasks near where you are", "Get directions for pickup and drop-off", "Confirm each handover with a code"],
    href: "/signup?type=VOLUNTEER",
    cta: "Sign up to volunteer",
  },
];

const capabilities = [
  { title: "Deadline-aware matching", body: "Listings are ranked for each NGO by distance, time left before the pickup deadline and declared daily capacity. Every match shows the reasons." },
  { title: "Organisation verification", body: "Donors and NGOs submit registration and FSSAI details with supporting documents. Unverified organisations can prepare listings but cannot publish or claim." },
  { title: "Custody codes", body: "Each rescue gets two single-use codes: one held by the donor for pickup, one held by the NGO for delivery. A reused or wrong code is rejected." },
  { title: "Food safety guidance", body: "Ask questions about surplus food rules and get answers drawn from the regulatory documents loaded into the platform, with citations. When the documents don't cover it, the assistant says so." },
  { title: "Expiry escalation", body: "Listings that are close to their deadline are flagged to operations staff. Listings that pass it are closed automatically so nobody collects unsafe food." },
  { title: "Reports from real records", body: "Rescued quantity, completion rate and monthly trends are calculated only from completed handovers, and can be exported as CSV." },
];

export default function HomePage() {
  const { t } = useMarketingLang();
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-forest-100 bg-forest-50 px-3 py-1 text-sm font-semibold text-forest">
              <span className="h-1.5 w-1.5 rounded-full bg-forest" aria-hidden />
              Now operating in Andhra Pradesh
            </p>
            <h1 className="max-w-[16ch] text-3xl font-bold sm:text-4xl">{t.heroTitle}</h1>
            <p className="mt-5 max-w-[52ch] text-lg text-muted">{t.heroBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">{t.start}</ButtonLink>
              <ButtonLink href="/how-it-works" variant="secondary" size="lg">{t.explore}</ButtonLink>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-md font-semibold">Every rescue is a chain of checked handovers</h2>
            </div>
            <CustodyChain steps={chain} />
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold">One network, three ways in</h2>
          <p className="mt-3 text-md text-muted">
            Each account type gets its own workspace, built around the work that role actually does.
          </p>
        </div>
        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {audiences.map((a) => (
            <div key={a.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <a.icon className="h-6 w-6 text-forest" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{a.title}</h3>
              <ul className="mt-3 space-y-2 text-base text-ink-soft">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2"><span aria-hidden className="mt-2.5 h-1 w-3 shrink-0 rounded-full bg-sage" />{p}</li>
                ))}
              </ul>
              <Link href={a.href} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">
                {a.cta} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Food safety */}
      <section id="food-safety" className="bg-forest text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:py-20">
          <div>
            <ShieldCheck className="h-7 w-7 text-mint" aria-hidden />
            <h2 className="mt-4 text-2xl font-semibold text-white">Safe to eat, and provably so</h2>
            <p className="mt-3 text-md text-white/80">
              Surplus food only helps if it is safe. FoodRescue builds the rules of the Food Safety and Standards
              (Recovery and Distribution of Surplus Food) Regulations, 2019 into each step, and records who held the
              food and when.
            </p>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-md bg-white/15 sm:grid-cols-2">
            {[
              ["Unserved food only", "Plate leftovers and food that has reached consumers are refused when the listing is created."],
              ["Time on every item", "Each listing carries preparation and expiry times. Expired listings close automatically."],
              ["Verified on both ends", "Donors and NGOs are reviewed before they can publish or claim food."],
              ["Recorded handovers", "Pickup and delivery are confirmed with single-use codes and kept in an audit log."],
            ].map(([title, body]) => (
              <div key={title} className="bg-forest p-5">
                <dt className="font-semibold text-white">{title}</dt>
                <dd className="mt-1 text-sm text-white/75">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold">What the platform handles</h2>
            <p className="mt-3 text-md text-muted">
              The parts of a rescue that usually live in phone calls and spreadsheets: who has food, who needs it,
              who is carrying it and whether it arrived.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {capabilities.map((c) => (
              <div key={c.title} className="border-t border-line pt-4">
                <dt className="font-semibold">{c.title}</dt>
                <dd className="mt-1.5 text-sm text-muted">{c.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Mission + live figures */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-16 md:grid-cols-2 md:py-20">
          <div>
            <h2 className="text-2xl font-semibold">Less food in landfill, more on plates</h2>
            <p className="mt-3 text-md text-muted">
              Food that rots in landfill releases methane, and every meal thrown away also wastes the water, energy and
              labour that went into it. Rescuing food close to where it is cooked, before it spoils, is one of the most
              direct ways a city can cut that waste while feeding people.
            </p>
            <p className="mt-3 text-md text-muted">
              We report only what the platform has recorded: listings created, handovers confirmed and quantities delivered.
            </p>
          </div>
          <LiveFigures />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-line bg-surface p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-xl font-semibold">Have surplus food, or people who need it?</h2>
            <p className="mt-1 text-muted">Create an account and tell us about your organisation. Our team reviews each one before it can publish or claim food.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/signup" size="lg">Get started</ButtonLink>
            <ButtonLink href="/contact" variant="secondary" size="lg">Talk to us</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
