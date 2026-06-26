import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_COOKIE, expectedToken, gatePassword } from "@/lib/demo-auth";

/**
 * Demo access gate (Next.js 16 `proxy` — formerly `middleware`).
 *
 * Runs on the Node.js runtime. Blocks the app and the AI memo route unless a
 * valid demo session cookie is present. The gate is active only when
 * `DEMO_ACCESS_PASSWORD` is configured; otherwise every request passes through
 * so local development needs no setup.
 */
export const config = {
  // Protect everything EXCEPT Next internals, static assets, the gate screen
  // itself, and the auth endpoint that issues the session cookie.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|gate|api/demo-auth).*)"],
};

export function proxy(request: NextRequest) {
  const password = gatePassword();

  // Gate disabled — no password configured. Let everything through.
  if (!password) {
    return NextResponse.next();
  }

  const token = request.cookies.get(DEMO_COOKIE)?.value;
  if (token && token === expectedToken(password)) {
    return NextResponse.next();
  }

  // Unauthenticated. API callers get a clean 401; humans get the gate screen.
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "unauthorized", message: "Demo access required." },
      { status: 401 },
    );
  }

  const gateUrl = new URL("/gate", request.url);
  // Preserve the intended destination so we can bounce the user back.
  if (pathname && pathname !== "/") {
    gateUrl.searchParams.set("from", pathname + search);
  }
  return NextResponse.redirect(gateUrl);
}
