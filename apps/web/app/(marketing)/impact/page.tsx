import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";
import { LiveFigures } from "@/components/marketing/live-figures";

export const metadata: Metadata = { title: "Our impact" };

export default function ImpactPage() {
  return (
    <>
      <PageIntro title="Impact we can show you">
        These figures are read live from the platform database. Test and demonstration records are excluded.
      </PageIntro>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-2">
        <LiveFigures detailed />
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">How we count</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
              <li>A rescue counts as completed only when the receiving NGO’s delivery code is entered.</li>
              <li>We report listings and quantities as donors recorded them. We don’t convert them into meals, emissions or rupees.</li>
              <li>Listings that expired unclaimed are reported too, because they show where the network needs to grow.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Organisation-level reports</h2>
            <p className="mt-2 text-muted">
              Donors, NGOs and companies each see their own monthly reports in their workspace and can export them as CSV.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
