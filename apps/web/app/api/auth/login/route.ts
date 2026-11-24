import { NextRequest, NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/server-config";

export const dynamic = "force-dynamic";

// Exchanges credentials for a session. The access token is stored in an httpOnly,
// SameSite=Lax cookie so it cannot be read by page scripts.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request." }, { status: 400 });
  }
  const form = new URLSearchParams();
  form.set("username", String(body.email ?? ""));
  form.set("password", String(body.password ?? ""));
  if (body.remember) form.set("remember", "true");

  const forwarded = req.headers.get("x-forwarded-for") ?? req.ip ?? "";
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...(forwarded ? { "X-Forwarded-For": forwarded } : {}) },
      body: form,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "The FoodRescue service is unavailable right now. Try again shortly." }, { status: 502 });
  }
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const res = NextResponse.json(data, { status: upstream.status });
    const retry = upstream.headers.get("Retry-After");
    if (retry) res.headers.set("Retry-After", retry);
    return res;
  }
  const res = NextResponse.json({ role: data.role, onboarding_completed: data.onboarding_completed });
  res.cookies.set(SESSION_COOKIE, data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: data.expires_in,
  });
  return res;
}
