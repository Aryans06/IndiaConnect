/**
 * Clerk middleware — only active when Clerk keys are present, so the app runs
 * fine in development without them. Account routes are protected; everything
 * else (directory, finder, detail pages) stays public for SEO.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

// Built lazily to avoid importing Clerk when it isn't configured.
async function clerkHandler(req: NextRequest) {
  const { clerkMiddleware, createRouteMatcher } = await import(
    "@clerk/nextjs/server"
  );
  const isProtected = createRouteMatcher(["/account(.*)"]);
  const handler = clerkMiddleware(async (auth, request) => {
    if (isProtected(request)) await auth.protect();
  });
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
