"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const [message, setMessage] = useState(token ? "" : "This confirmation link is incomplete.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api("/auth/verify-email", { json: { token } })
      .then(() => setState("done"))
      .catch((err) => {
        setState("failed");
        setMessage(errorMessage(err));
      });
  }, [token]);

  if (state === "working") {
    return (
      <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Confirming your email address…</p>
    );
  }
  if (state === "done") {
    return (
      <div>
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Email address confirmed</h1>
        <p className="mt-2 text-muted">Thanks. You can carry on where you left off.</p>
        <p className="mt-6"><Link href="/dashboard" className="link font-semibold">Go to your workspace</Link></p>
      </div>
    );
  }
  return (
    <div>
      <XCircle className="h-8 w-8 text-danger" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">We couldn’t confirm your email</h1>
      <p className="mt-2 text-muted">{message} Sign in and use <strong>Resend email</strong> on the banner at the top of your workspace to get a new link.</p>
      <p className="mt-6"><Link href="/login" className="link font-semibold">Sign in</Link></p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
