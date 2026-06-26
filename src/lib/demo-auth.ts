/**
 * Shared demo-access gate helpers.
 *
 * A lightweight password gate for the deployed prototype. The shared password
 * lives ONLY in the server-side env var `DEMO_ACCESS_PASSWORD` — it is never
 * hardcoded and never exposed to the browser (no NEXT_PUBLIC_). The session
 * cookie stores an opaque salted hash of the password, not the password itself.
 *
 * If `DEMO_ACCESS_PASSWORD` is unset, the gate is DISABLED so local development
 * works with no extra setup (see proxy.ts).
 *
 * Pure module (only `node:crypto`) so it can be imported by both the Node-runtime
 * proxy and the auth route handler.
 */

import { createHash } from "node:crypto";

/** Name of the short-lived session cookie. */
export const DEMO_COOKIE = "demo_access";

/** Session lifetime in seconds (8 hours) — short-lived, survives refreshes. */
export const DEMO_SESSION_MAX_AGE = 60 * 60 * 8;

/**
 * The shared demo password, or `undefined` when the gate is disabled.
 * Treats an empty/whitespace value as unset.
 */
export function gatePassword(): string | undefined {
  const value = process.env.DEMO_ACCESS_PASSWORD;
  return value && value.trim().length > 0 ? value : undefined;
}

/**
 * Opaque session token derived from the password. Salted + versioned so the
 * stored cookie value is not a bare hash of a (possibly guessable) password.
 */
export function expectedToken(password: string): string {
  return createHash("sha256").update(`cfrp-demo:v1:${password}`).digest("hex");
}
