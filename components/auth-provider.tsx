import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";

/**
 * Wraps the app in ClerkProvider only when Clerk is configured, so the app
 * still renders without keys (auth simply stays unavailable / dev-mock).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}
