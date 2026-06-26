/**
 * Auth abstraction. Identity lives in Clerk; this maps the current Clerk
 * session to our app `User` row (creating it on first sight — sync-on-request,
 * no webhook round-trip needed).
 *
 * For local development without Clerk keys, set DEV_MOCK_AUTH=true to sign in
 * as a fixed mock user so the account/profile/DigiLocker flows are testable.
 */
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

function isDevMockAuth(): boolean {
  return !isClerkConfigured() && process.env.DEV_MOCK_AUTH === "true";
}

const MOCK_CLERK_ID = "dev-mock-user";

/** Upsert and return the app User for a given Clerk id. */
async function syncUser(clerkId: string, name?: string | null): Promise<User> {
  return prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, name: name ?? null },
    update: name ? { name } : {},
  });
}

/**
 * Returns the current app User, or null if not signed in. Safe to call from
 * server components and route handlers.
 */
export async function getAuthedUser(): Promise<User | null> {
  if (isDevMockAuth()) {
    return syncUser(MOCK_CLERK_ID, "Demo Citizen");
  }
  if (!isClerkConfigured()) return null;

  // Imported lazily so the app builds/runs even without Clerk configured.
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return null;

  const cu = await currentUser();
  const name =
    cu?.firstName || cu?.lastName
      ? [cu?.firstName, cu?.lastName].filter(Boolean).join(" ")
      : (cu?.username ?? null);
  return syncUser(userId, name);
}

/** Like getAuthedUser but throws — for routes that require a session. */
export async function requireUser(): Promise<User> {
  const user = await getAuthedUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
