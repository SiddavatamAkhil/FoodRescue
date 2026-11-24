import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/marketing/page-intro";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <>
      <PageIntro title="Terms of service">The rules for using FoodRescue.</PageIntro>
      <section className="mx-auto max-w-6xl px-5 py-14">
        <Prose>
          <h2>Accounts</h2>
          <p>You must give accurate information and keep your sign-in details private. Organisation accounts must be created by someone authorised to act for that organisation.</p>
          <h2>Food donors</h2>
          <ul>
            <li>List only unserved food that has been prepared, handled and stored in line with applicable food safety law.</li>
            <li>Give accurate quantities, preparation times and expiry times, and keep food in suitable conditions until it is collected.</li>
            <li>Hand food only to the assigned volunteer, after their pickup code is confirmed.</li>
          </ul>
          <h2>NGOs and food banks</h2>
          <ul>
            <li>Claim only food you can store, serve or distribute safely before it expires.</li>
            <li>Distribute food free of charge to the people you serve.</li>
            <li>Confirm delivery only when the food has actually arrived.</li>
          </ul>
          <h2>Volunteers</h2>
          <ul>
            <li>Accept only pickups you can complete before the deadline, and follow the storage instructions on the listing.</li>
            <li>Report any problem, such as a delay, damaged packaging or a quantity mismatch, through the platform.</li>
          </ul>
          <h2>Platform role</h2>
          <p>
            FoodRescue coordinates rescues and enforces its listing rules. It does not inspect food and is not a party to the
            transfer of food between donors and recipients. Each participant remains responsible for their own legal obligations.
          </p>
          <h2>Suspension</h2>
          <p>We may suspend accounts that break these terms or put food safety at risk.</p>
        </Prose>
      </section>
    </>
  );
}
