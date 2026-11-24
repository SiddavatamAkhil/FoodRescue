"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Languages, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { useMarketingLang } from "@/lib/marketing-i18n";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const { t, toggle } = useMarketingLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: "/", label: t.home },
    { href: "/how-it-works", label: t.how },
    { href: "/for-restaurants", label: t.restaurants },
    { href: "/for-ngos", label: t.ngos },
    { href: "/impact", label: t.impact },
    { href: "/about", label: t.about },
    { href: "/contact", label: t.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={cn(
                    "rounded px-2.5 py-2 text-sm font-semibold transition-colors",
                    pathname === l.href ? "text-forest" : "text-muted hover:text-ink",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <button type="button" onClick={toggle} className="inline-flex h-9 items-center gap-1.5 rounded px-2 text-sm font-semibold text-muted hover:text-ink" title="Switch language" lang={t.switchTo === "English" ? "en" : "te"}>
            <Languages className="h-4 w-4" aria-hidden /> {t.switchTo}
          </button>
          <ButtonLink href="/login" variant="ghost" size="sm">{t.login}</ButtonLink>
          <ButtonLink href="/signup" size="sm">{t.start}</ButtonLink>
        </div>
        <button type="button" className="rounded p-2 text-ink lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-surface px-5 pb-5 pt-2 lg:hidden">
          <ul className="divide-y divide-line">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block py-3 font-semibold text-ink" aria-current={pathname === l.href ? "page" : undefined}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink href="/signup">{t.start}</ButtonLink>
            <ButtonLink href="/login" variant="secondary">{t.login}</ButtonLink>
            <button type="button" onClick={toggle} title="Switch language" lang={t.switchTo === "English" ? "en" : "te"} className="mt-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-muted">
              <Languages className="h-4 w-4" aria-hidden /> {t.switchTo}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
