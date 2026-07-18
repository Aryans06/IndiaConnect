/**
 * Clerk middleware — only active when Clerk keys are present, so the app runs
 * fine in development without them.
 *
 * It supplies the auth context but deliberately does NOT hard-block any route.
 * `auth.protect()` 404s when it has no sign-in URL to redirect to, which is a
 * dead end for a signed-out visitor. Instead each surface handles it properly:
 * /account renders a "Sign in to continue" prompt, and the write APIs return
 * 401. Everything else stays public for SEO.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

// Built lazily to avoid importing Clerk when it isn't configured.
async function clerkHandler(req: NextRequest) {
  const { clerkMiddleware } = await import("@clerk/nextjs/server");
  const handler = clerkMiddleware();
  // @ts-expect-error — event arg is optional for our usage
  return handler(req);
}

export default function middleware(req: NextRequest) {
  if (!clerkConfigured) return NextResponse.next();
  return clerkHandler(req);
}

export const config = {
  matcher: [
    // Skip Next internals and static files; run on app routes + APIs.
    "/((?!_next|.*\\..*).*)",
    "/(api)(.*)",
  ],
};
