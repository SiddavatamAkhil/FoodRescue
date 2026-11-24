"use client";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { MonthlyReport } from "@/components/shared/insights";
import { useMeRequired } from "@/lib/use-me-required";

export default function SustainabilityPage() {
  const me = useMeRequired();
  return (
    <>
      <PageHeader title="Sustainability reports" description="Food diverted from waste, month by month, for sustainability disclosures." />
      <div className="space-y-6">
        <MonthlyReport orgId={me.organization!.id} filePrefix="foodrescue-sustainability" />
        <Panel>
          <PanelHeader title="Using these figures" />
          <PanelBody className="space-y-2 text-sm text-ink-soft">
            <p>“Rescued” counts only donations whose delivery the receiving NGO confirmed with its code. Each figure can be traced to individual records in Food rescue activity.</p>
            <p className="text-muted">FoodRescue reports quantities as your teams recorded them. It doesn’t convert them into emissions or monetary values; if your reporting framework needs those, apply your own factors to the exported CSV.</p>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
