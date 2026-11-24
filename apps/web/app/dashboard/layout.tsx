"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ROLE_SECTION } from "@/components/app/nav";
import { LogoMark } from "@/components/brand/logo";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { homeFor, signOut, useMe } from "@/lib/session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: me, error, isLoading, refetch } = useMe();
  const pathname = usePathname();
  const router = useRouter();

  const section = me ? ROLE_SECTION[me.role] : null;
  const segment = pathname.split("/")[2] ?? "";
  const needsOnboarding = !!me && !me.onboarding_completed && !["ADMIN", "OPS_MANAGER"].includes(me.role);
  const wrongSection = !!me && segment !== "" && segment !== section;

  useEffect(() => {
    if (!me) return;
    // Route guard for navigation only. The API independently rejects any request the role isn't allowed to make.
    if (needsOnboarding) router.replace("/onboarding");
    else if (segment === "" || wrongSection) router.replace(homeFor(me));
  }, [me, needsOnboarding, wrongSection, segment, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-5 py-24">
        <Alert tone="danger" title="We couldn't load your account">{errorMessage(error)}</Alert>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => refetch()}>Try again</Button>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }
  if (isLoading || !me || needsOnboarding || segment === "" || wrongSection) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <LogoMark className="h-10 w-10 animate-pulse" />
        <span className="sr-only">Loading your workspace</span>
      </div>
    );
  }
  return <AppShell me={me}>{children}</AppShell>;
}
