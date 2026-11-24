"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import type { Me } from "@/lib/types";

export function AccountBanners({ me }: { me: Me }) {
  const { notify } = useToast();
  const [sending, setSending] = useState(false);
  const org = me.organization;
  const section = me.role === "RECIPIENT" ? "ngo" : me.role.toLowerCase();

  async function resend() {
    setSending(true);
    try {
      const r = await api<{ message: string }>("/auth/resend-verification", { method: "POST" });
      notify(r.message);
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setSending(false);
    }
  }

  const banners: React.ReactNode[] = [];
  if (org && org.verification_status !== "VERIFIED") {
    const s = org.verification_status;
    const restricted = me.role === "RECIPIENT" ? "claim donations" : "publish donations";
    const text =
      s === "INFO_REQUIRED" ? <>Your reviewer asked for more information{org.verification_notes ? <>: <q>{org.verification_notes}</q></> : "."} Update your details or documents to resubmit.</>
      : s === "REJECTED" ? <>Your verification was not approved{org.verification_notes ? <>: <q>{org.verification_notes}</q></> : "."} You can correct your details and resubmit.</>
      : s === "SUSPENDED" ? <>This organisation is suspended. Contact the FoodRescue team to resolve it.</>
      : <>Your organisation is {s === "UNDER_REVIEW" ? "under review" : "waiting for review"}. You can’t {restricted} until it’s verified.</>;
    banners.push(
      <div key="verify" className={s === "REJECTED" || s === "SUSPENDED" ? "border-b border-danger/20 bg-danger-50" : "border-b border-warning/25 bg-warning-50"}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
          <p className="text-ink">{text}</p>
          {s !== "SUSPENDED" && (
            <Link href={`/dashboard/${section}/settings#verification`} className="font-semibold text-forest hover:underline">
              {s === "PENDING" || s === "UNDER_REVIEW" ? "View documents" : "Update and resubmit"}
            </Link>
          )}
        </div>
      </div>,
    );
  }
  if (!me.email_verified && !["ADMIN", "OPS_MANAGER"].includes(me.role)) {
    banners.push(
      <div key="email" className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
          <p className="text-ink-soft">Confirm your email address. We sent a link to <strong className="text-ink">{me.email}</strong>.</p>
          <button type="button" onClick={resend} disabled={sending} className="font-semibold text-forest hover:underline disabled:opacity-50">
            {sending ? "Sending…" : "Resend email"}
          </button>
        </div>
      </div>,
    );
  }
  return <>{banners}</>;
}
