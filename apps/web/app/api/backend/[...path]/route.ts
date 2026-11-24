import { NextRequest, NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/server-config";

export const dynamic = "force-dynamic";

// Same-origin proxy to the FastAPI service. Adds the bearer token from the session
// cookie; the backend remains the sole authority for authentication and authorization.
async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.map(encodeURIComponent).join("/");
  const search = req.nextUrl.search;
  // FastAPI routers are mounted with trailing slashes for collection endpoints.
  const url = `${API_URL}/api/v1/${path}${req.nextUrl.pathname.endsWith("/") ? "/" : ""}${search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const forwarded = req.headers.get("x-forwarded-for") ?? req.ip;
  if (forwarded) headers.set("x-forwarded-for", forwarded);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ detail: "The FoodRescue service is unavailable right now." }, { status: 502 });
  }

  const outHeaders = new Headers();
  for (const h of ["content-type", "content-disposition", "retry-after"]) {
    const v = upstream.headers.get(h);
    if (v) outHeaders.set(h, v);
  }
  const res = new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: outHeaders });
  // An expired or revoked session is cleared so route guards send the user to sign in.
  if (upstream.status === 401) res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
