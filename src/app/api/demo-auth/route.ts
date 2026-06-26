import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  DEMO_COOKIE,
  DEMO_SESSION_MAX_AGE,
  expectedToken,
  gatePassword,
} from "@/lib/demo-auth";

/**
 * Demo access authentication route.
 *
 * Verifies the submitted password against `DEMO_ACCESS_PASSWORD` (server-side
 * only) and, on success, sets a short-lived httpOnly session cookie. The
 * password is never returned and never stored client-readable.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const password = gatePassword();

  // Gate disabled — nothing to authenticate against. Report it as open so the
  // client can simply proceed into the app.
  if (!password) {
    return Response.json({ ok: true, disabled: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const submitted =
    body &&
    typeof body === "object" &&
    typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  // Compare equal-length salted hashes in constant time.
  const a = Buffer.from(expectedToken(submitted), "hex");
  const b = Buffer.from(expectedToken(password), "hex");
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    return Response.json(
      { ok: false, error: "invalid_password" },
      { status: 401 },
    );
  }

  const store = await cookies();
  store.set({
    name: DEMO_COOKIE,
    value: expectedToken(password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE,
  });

  return Response.json({ ok: true });
}
