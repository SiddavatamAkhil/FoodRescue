"use client";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody } from "@/components/ui/panel";
import { VolunteerForm } from "@/components/shared/volunteer-form";
import { useToast } from "@/components/ui/toast";
import { useMeRequired } from "@/lib/use-me-required";
import { useRefreshMe } from "@/lib/session";

export default function AvailabilityPage() {
  const me = useMeRequired();
  const refresh = useRefreshMe();
  const { notify } = useToast();
  return (
    <>
      <PageHeader title="Availability" description="When and where you can help, and what you can carry." />
      <Panel><PanelBody><VolunteerForm me={me} submitLabel="Save availability" onDone={async () => { await refresh(); notify("Availability saved"); }} /></PanelBody></Panel>
    </>
  );
}
