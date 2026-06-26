import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { getDigiLockerProvider } from "@/lib/digilocker/provider";

/** Kicks off the DigiLocker OAuth flow (or the mock shortcut in dev). */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.redirect(new URL("/account", baseUrl()));
  }
  const provider = getDigiLockerProvider();
  // State ties the callback back to this user. In production use a signed,
  // single-use value; the mock flow round-trips it verbatim.
  const url = provider.getAuthorizeUrl(user.id);
  return NextResponse.redirect(url);
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
