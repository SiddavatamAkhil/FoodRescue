"use client";
import { PageHeader } from "@/components/ui/misc";
import { ActiveAssignments } from "@/components/volunteer/tasks";
import { useMeRequired } from "@/lib/use-me-required";

export default function AssignmentsPage() {
  const me = useMeRequired();
  return (<><PageHeader title="My assignments" description="Collect, then deliver. Each step is confirmed with a code from the person handing over." /><ActiveAssignments origin={me.volunteer ? { lat: me.volunteer.latitude, lng: me.volunteer.longitude } : null} /></>);
}
