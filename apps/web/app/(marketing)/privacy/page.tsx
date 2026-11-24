import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/marketing/page-intro";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageIntro title="Privacy policy">How FoodRescue collects, uses and protects personal information.</PageIntro>
      <section className="mx-auto max-w-6xl px-5 py-14">
        <Prose>
          <h2>What we collect</h2>
          <ul>
            <li>Account details: name, email address, phone number and account type.</li>
            <li>Organisation details you provide during onboarding, including registration numbers, addresses and verification documents.</li>
            <li>Operational records: listings, claims, pickups, custody confirmations and the time and account behind each action.</li>
            <li>Volunteer availability and, if you choose to share it, an approximate location to sort nearby tasks.</li>
          </ul>
          <h2>How we use it</h2>
          <ul>
            <li>To run rescues: showing listings to eligible NGOs, connecting volunteers with pickups and confirming handovers.</li>
            <li>To verify organisations before they can publish or claim food.</li>
            <li>To keep an audit trail for food safety and dispute resolution.</li>
            <li>To send account emails such as address confirmation and password reset.</li>
          </ul>
          <h2>Who can see it</h2>
          <p>
            Pickup addresses and contact details are shared only with the parties to a rescue. Verification documents are
            visible to your organisation’s members and FoodRescue administrators. We do not sell personal information.
          </p>
          <h2>Security</h2>
          <p>
            Passwords are stored as Argon2id hashes. Sessions are held in secure, HTTP-only cookies and expire automatically.
            Repeated failed sign-ins are temporarily blocked.
          </p>
          <h2>Your choices</h2>
          <p>
            You can update your profile at any time from Settings. To close your account or request a copy of your data,
            contact us through the <a className="link" href="/contact">contact page</a>.
          </p>
        </Prose>
      </section>
    </>
  );
}
