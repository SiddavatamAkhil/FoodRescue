"use client";
import { PageHeader } from "@/components/ui/misc";
import { PasswordSettings, ProfileSettings } from "@/components/shared/settings";
import { useMeRequired } from "@/lib/use-me-required";

export default function VolunteerProfilePage() {
  const me = useMeRequired();
  return (<><PageHeader title="Profile" /><div className="space-y-6"><ProfileSettings me={me} /><PasswordSettings /></div></>);
}
