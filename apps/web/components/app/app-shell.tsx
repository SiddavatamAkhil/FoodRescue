"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { VerificationBadge } from "@/components/ui/status";
import { NAV, ROLE_SECTION, type NavGroup } from "./nav";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { AccountBanners } from "./account-banners";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/cn";

function SideNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Workspace" className="space-y-6">
      {groups.map((g, i) => (
        <div key={g.label ?? i}>
          {g.label && <p className="mb-1.5 px-3 text-xs font-semibold text-muted">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "bg-forest-50 text-forest" : "text-ink-soft hover:bg-canvas hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-forest" aria-hidden />}
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-forest" : "text-muted")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const section = ROLE_SECTION[me.role];
  const groups = NAV[section];
  const settingsHref = section === "volunteer" ? "/dashboard/volunteer/profile" : section === "admin" ? "/dashboard/admin/settings" : `/dashboard/${section}/settings`;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const orgLine = me.organization ? (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{me.organization.name}</p>
      <div className="mt-1"><VerificationBadge status={me.organization.verification_status} /></div>
    </div>
  ) : me.role === "VOLUNTEER" ? (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{me.full_name}</p>
      <p className="text-xs text-muted">{me.volunteer?.service_area ?? "Volunteer"}</p>
    </div>
  ) : (
    <div className="min-w-0">
      <p className="text-sm font-semibold">Platform operations</p>
      <p className="text-xs text-muted">Administrator access</p>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5"><Logo href="/dashboard" /></div>
        <div className="border-y border-line px-5 py-3">{orgLine}</div>
        <div className="flex-1 overflow-y-auto px-3 py-5"><SideNav groups={groups} /></div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-fade-in flex-col bg-surface">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo href="/dashboard" />
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1.5 text-muted hover:bg-canvas" aria-label="Close navigation"><X className="h-5 w-5" /></button>
            </div>
            <div className="border-y border-line px-5 py-3">{orgLine}</div>
            <div className="flex-1 overflow-y-auto px-3 py-5"><SideNav groups={groups} onNavigate={() => setOpen(false)} /></div>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
        <button type="button" onClick={() => setOpen(true)} className="rounded p-2 text-ink hover:bg-canvas lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <div className="lg:hidden"><Logo href="/dashboard" className="[&>span]:hidden sm:[&>span]:inline" /></div>
        <div className="ml-auto flex items-center gap-1">
          <NotificationsMenu />
          <UserMenu me={me} settingsHref={settingsHref} />
        </div>
      </header>

      <AccountBanners me={me} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
