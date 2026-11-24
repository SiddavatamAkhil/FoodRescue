import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "fr_session";
const PROTECTED = ["/dashboard", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

// Reads the JWT expiry without verifying the signature. This only decides where to
// route the browser; every API call is still authenticated and authorized by the backend.
function sessionIsLive(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const live = sessionIsLive(req.cookies.get(SESSION_COOKIE)?.value);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !live) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}${req.cookies.get(SESSION_COOKIE) ? "&expired=1" : ""}`;
    const res = NextResponse.redirect(url);
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  if (AUTH_PAGES.includes(pathname) && live) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/login", "/signup"],
};
