// Server-only configuration for route handlers and middleware.
export const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const SESSION_COOKIE = "fr_session";
