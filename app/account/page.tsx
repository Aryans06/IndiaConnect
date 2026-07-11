import type { Metadata } from "next";
import Link from "next/link";
import { getAuthedUser, isClerkConfigured } from "@/lib/auth";
import { getProfile, getBookmarks, getApplications } from "@/lib/account";
import { prisma } from "@/lib/db";
import { ATTRIBUTES } from "@/lib/eligibility/attributes";

export const metadata: Metadata = { title: "My account" };

const STATUS_LABEL: Record<string, string> = {
  SAVED: "Saved to apply",
  IN_PROGRESS: "Applying now",
  APPLIED: "Applied",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ digilocker?: string }>;
}) {
  const { digilocker } = await searchParams;
  const user = await getAuthedUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Sign in to continue</h1>
        <p className="mt-2 text-ink-soft">
          {isClerkConfigured()
            ? "Use the Sign in button in the header to access your account."
            : "Authentication isn't configured yet. Set Clerk keys (or DEV_MOCK_AUTH=true) to enable accounts."}
        </p>
        <Link
          href="/finder"
          className="mt-6 inline-block rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white"
        >
          Check eligibility instead →
        </Link>
      </main>
    );
  }

  const [profile, bookmarks, applications, link] = await Promise.all([
    getProfile(user.id),
    getBookmarks(user.id),
    getApplications(user.id),
    prisma.digiLockerLink.findUnique({
      where: { userId: user.id },
      include: { documents: { orderBy: { name: "asc" } } },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <p className="eyebrow">Your account</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
        {user.name ? `Hello, ${user.name}` : "Your dashboard"}
      </h1>

      {digilocker === "connected" && (
        <Banner tone="ok">DigiLocker connected — your documents are synced.</Banner>
      )}
      {digilocker === "error" && (
        <Banner tone="err">Couldn&apos;t connect DigiLocker. Please try again.</Banner>
      )}

      {/* Profile */}
      <Card title="Your profile" action={{ href: "/account/profile", label: profile ? "Edit" : "Complete" }}>
        {profile ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <Field label={ATTRIBUTES.age.label} value={profile.age} />
            <Field label={ATTRIBUTES.gender.label} value={cap(profile.gender)} />
            <Field label={ATTRIBUTES.occupation.label} value={cap(profile.occupation)} />
            <Field
              label={ATTRIBUTES.annualIncome.label}
              value={profile.annualIncome != null ? `₹${profile.annualIncome.toLocaleString("en-IN")}` : null}
            />
            <Field label={ATTRIBUTES.socialCategory.label} value={profile.socialCategory} />
            <Field label={ATTRIBUTES.rationCardType.label} value={profile.rationCardType} />
          </dl>
        ) : (
          <p className="text-sm text-ink-soft">
            Add your details once to get personalized scheme matches everywhere.
          </p>
        )}
      </Card>

      {/* DigiLocker */}
      <Card title="DigiLocker documents">
        {link ? (
          <>
            <p className="text-sm text-eligible">
              ✓ Connected · {link.documents.length} document
              {link.documents.length === 1 ? "" : "s"} synced
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {link.documents.map((d) => (
                <li
                  key={d.id}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs"
                >
                  {d.name}
                </li>
              ))}
            </ul>
            <a
              href="/api/digilocker/connect"
              className="mt-3 inline-block text-xs font-semibold text-saffron-ink hover:underline"
            >
              Re-sync documents
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              Connect DigiLocker to automatically check which required documents
              you already have for each scheme.
            </p>
            <a
              href="/api/digilocker/connect"
              className="mt-3 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-soft"
            >
              Connect DigiLocker
            </a>
          </>
        )}
      </Card>

      {/* Applications */}
      <Card title={`Tracked applications (${applications.length})`}>
        {applications.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Track schemes you&apos;re applying for from any scheme page.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <Link
                  href={`/schemes/${a.scheme.slug}`}
                  className="text-sm font-medium hover:text-saffron-ink"
                >
                  {a.scheme.title}
                </Link>
                <span className="eyebrow">{STATUS_LABEL[a.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Bookmarks */}
      <Card title={`Saved schemes (${bookmarks.length})`}>
        {bookmarks.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Tap “Save” on any scheme to keep it here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {bookmarks.map((b) => (
              <li key={b.id} className="py-2.5">
                <Link
                  href={`/schemes/${b.scheme.slug}`}
                  className="text-sm font-medium hover:text-saffron-ink"
                >
                  {b.scheme.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-lg border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-sm font-semibold text-saffron-ink hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "ok" | "err";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "ok"
          ? "mt-4 rounded-lg border border-eligible/30 bg-eligible-soft px-4 py-2.5 text-sm text-eligible"
          : "mt-4 rounded-lg border border-denied/30 bg-denied-soft px-4 py-2.5 text-sm text-denied"
      }
    >
      {children}
    </div>
  );
}

function cap(s: string | null): string | null {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
