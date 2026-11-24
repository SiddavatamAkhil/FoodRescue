import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/marketing/page-intro";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <>
      <PageIntro title="We make rescuing food the easy option">
        FoodRescue is a coordination platform for surplus food. It is designed for the region it serves, starting with Andhra Pradesh.
      </PageIntro>
      <section className="mx-auto max-w-6xl px-5 py-14">
        <Prose>
          <h2>Why we built it</h2>
          <p>
            Surplus food is usually fine at nine in the evening and unsafe by morning. Saving it depends on a donor, an NGO and
            someone with a vehicle agreeing on a plan within a couple of hours. Most of that coordination happens by phone,
            and most of it breaks down when one person can’t be reached.
          </p>
          <p>
            FoodRescue replaces those phone chains with a shared, time-aware workflow: one listing, one claim, one volunteer,
            two confirmed handovers.
          </p>
          <h2>How we work</h2>
          <ul>
            <li><strong>Safety decisions are rules, not suggestions.</strong> Eligibility, verification, claims and custody checks are fixed logic that can be tested and audited.</li>
            <li><strong>Assistance where it helps.</strong> Language tools help fill in listings and answer regulation questions, with sources. They never decide whether food is safe.</li>
            <li><strong>Honest numbers.</strong> We publish counts from confirmed records only.</li>
            <li><strong>Local first.</strong> Indian time zones, Indian registration schemes, and a Telugu version of the public site.</li>
          </ul>
          <h2>Get in touch</h2>
          <p>
            If you run a food business, an NGO or a CSR programme and want to take part, <a className="link" href="/contact">send us a message</a>.
          </p>
        </Prose>
      </section>
    </>
  );
}
