import type { Metadata } from "next";
import { FinderWizard } from "@/components/finder-wizard";
import { getAuthedUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Check your eligibility",
  description:
    "Answer a few simple questions and see the government schemes you may qualify for.",
};

export default async function FinderPage() {
  const user = await getAuthedUser();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <FinderWizard signedIn={Boolean(user)} />
    </main>
  );
}
