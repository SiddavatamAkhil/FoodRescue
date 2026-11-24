"use client";
import { PageHeader } from "@/components/ui/misc";
import { SettingsView } from "@/components/shared/settings";
import { useMeRequired } from "@/lib/use-me-required";

export default function NgoSettingsPage() {
  const me = useMeRequired();
  return (<><PageHeader title="Settings" /><SettingsView me={me} /></>);
}
