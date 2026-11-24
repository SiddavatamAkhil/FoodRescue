"use client";
import { PageHeader } from "@/components/ui/misc";
import { AvailableTasks } from "@/components/volunteer/tasks";

export default function TasksPage() {
  return (<><PageHeader title="Available tasks" description="Claimed donations that need someone to carry them. Nearest first when your location is saved." /><AvailableTasks /></>);
}
