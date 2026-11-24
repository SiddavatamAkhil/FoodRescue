"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { initials } from "@/lib/format";
import { signOut, ROLE_LABEL } from "@/lib/session";
import type { Me } from "@/lib/types";

export function UserMenu({ me, settingsHref }: { me: Me; settingsHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded py-1 pl-1 pr-2 hover:bg-canvas" aria-expanded={open} aria-haspopup="menu">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-xs font-bold text-white" aria-hidden>{initials(me.full_name)}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight">{me.full_name}</span>
          <span className="block text-xs leading-tight text-muted">{ROLE_LABEL[me.role]}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-60 animate-fade-in rounded-md border border-line bg-surface py-1 shadow-pop">
          <div className="border-b border-line px-4 py-2.5">
            <p className="truncate text-sm font-semibold">{me.full_name}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
          <Link role="menuitem" href={settingsHref} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-canvas">
            <Settings className="h-4 w-4 text-muted" aria-hidden /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-canvas">
            <LogOut className="h-4 w-4 text-muted" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
