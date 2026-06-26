"use client";

import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

const accountLink =
  "rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-sunken hover:text-ink";

/**
 * Auth controls in the header. `mode` is decided on the server so we never
 * call Clerk hooks unless a ClerkProvider is present.
 */
export function AuthNav({ mode }: { mode: "clerk" | "mock" | "none" }) {
  if (mode === "clerk") return <ClerkNav />;

  if (mode === "mock") {
    return (
      <Link href="/account" className={accountLink}>
        My account
        <span className="ml-1.5 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.6rem] text-muted">
          DEMO
        </span>
      </Link>
    );
  }

  return null;
}

function ClerkNav() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className={accountLink}>Sign in</button>
      </SignInButton>
    );
  }
  return (
    <>
      <Link href="/account" className={accountLink}>
        My account
      </Link>
      <UserButton />
    </>
  );
}
