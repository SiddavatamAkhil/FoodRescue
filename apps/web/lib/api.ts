// Browser-side API client. Requests go to the same-origin proxy (/api/backend/...),
// which attaches the session from an httpOnly cookie. The token never reaches page JavaScript.

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type Detail = string | { loc?: (string | number)[]; msg?: string }[] | undefined;

function readDetail(body: unknown): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  if (!body || typeof body !== "object") return { message: "Something went wrong. Try again.", fields };
  const b = body as { detail?: Detail; error?: { message?: string } };
  if (typeof b.detail === "string") return { message: b.detail, fields };
  if (Array.isArray(b.detail)) {
    for (const e of b.detail) {
      const loc = (e.loc ?? []).filter((p) => p !== "body").join(".");
      const msg = (e.msg ?? "Invalid value").replace(/^Value error, /, "");
      if (loc && !fields[loc]) fields[loc] = msg;
    }
    const first = Object.values(fields)[0];
    return { message: first ? `Check the highlighted fields. ${first}` : "Check the form and try again.", fields };
  }
  if (b.error?.message) return { message: b.error.message, fields };
  return { message: "Something went wrong. Try again.", fields };
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; json?: unknown; form?: FormData | URLSearchParams; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }
  const res = await fetch(`/api/backend${path}`, {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    signal: options.signal,
    credentials: "same-origin",
  });

  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?expired=1&next=${next}`;
    throw new ApiError("Your session has ended. Sign in again.", 401);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 504) {
      throw new ApiError("The FoodRescue service is unavailable right now. Try again shortly.", res.status);
    }
    const { message, fields } = readDetail(data);
    throw new ApiError(message, res.status, fields);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}
