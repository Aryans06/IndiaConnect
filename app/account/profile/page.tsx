import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getProfile } from "@/lib/account";
import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfilePage() {
  const user = await getAuthedUser();
  if (!user) redirect("/account");

  const profile = await getProfile(user.id);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-10">
      <Link href="/account" className="eyebrow hover:text-ink">
        ← Back to account
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">
        Your details
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        We use these to match you to schemes. Share only what you&apos;re
        comfortable with — every field is optional.
      </p>

      <div className="mt-7">
        <ProfileForm
          initial={{
            age: profile?.age ?? null,
            gender: profile?.gender ?? null,
            occupation: profile?.occupation ?? null,
            annualIncome: profile?.annualIncome ?? null,
            socialCategory: profile?.socialCategory ?? null,
            rationCardType: profile?.rationCardType ?? null,
            isDisabled: profile?.isDisabled ?? null,
            state: profile?.state ?? null,
          }}
        />
      </div>
    </main>
  );
}
