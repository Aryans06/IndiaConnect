import type { Metadata } from "next";
import { FinderWizard } from "@/components/finder-wizard";
import { getAuthedUser } from "@/lib/auth";
import { getProfile, profileToMatcherInput } from "@/lib/account";

export const metadata: Metadata = {
  title: "Check your eligibility",
  description:
    "Answer a few simple questions and see the government schemes you may qualify for.",
};

export default async function FinderPage() {
  const user = await getAuthedUser();
  // Signed-in citizens shouldn't have to re-answer what we already know.
  const profile = user ? await getProfile(user.id) : null;
  const initial = profileToMatcherInput(profile);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <FinderWizard signedIn={Boolean(user)} initialProfile={initial} />
    </main>
  );
}
