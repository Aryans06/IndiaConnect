import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSchemeBySlug } from "@/lib/schemes";
import { getAttribute } from "@/lib/eligibility/attributes";
import type { RuleOperator, RuleValue } from "@/lib/eligibility/rules";
import { getAuthedUser } from "@/lib/auth";
import { getUserSchemeState } from "@/lib/account";
import {
  getUserDocTypes,
  matchDocuments,
  type DocMatch,
} from "@/lib/digilocker/documents";
import { getDocGuide } from "@/lib/documents-guide";
import { SchemeActions } from "@/components/scheme-actions";
import { ApplicationSteps } from "@/components/application-steps";
import { DeadlineBadge } from "@/components/deadline-badge";
import { getLocale } from "@/lib/i18n/server";
import { localizeScheme } from "@/lib/i18n/translate-scheme";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const scheme = await getSchemeBySlug(slug);
  if (!scheme) return { title: "Scheme not found" };
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    title: scheme.title,
    description: scheme.summary,
    alternates: { canonical: `${base}/schemes/${slug}` },
    openGraph: {
      title: scheme.title,
      description: scheme.summary,
      url: `${base}/schemes/${slug}`,
      type: "article",
    },
  };
}

/** schema.org GovernmentService — lets search engines surface the scheme itself. */
function SchemeJsonLd({
  scheme,
  url,
}: {
  scheme: NonNullable<Awaited<ReturnType<typeof getSchemeBySlug>>>;
  url: string;
}) {
  const json = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: scheme.title,
    description: scheme.summary,
    serviceType: scheme.category ?? undefined,
    url,
    provider: {
      "@type": "GovernmentOrganization",
      name: scheme.ministry ?? "Government of India",
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: scheme.level === "STATE" ? (scheme.state ?? "India") : "India",
    },
    ...(scheme.sourceUrl ? { sameAs: scheme.sourceUrl } : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

export default async function SchemeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const scheme = await getSchemeBySlug(slug);
  if (!scheme) notFound();

  const place =
    scheme.level === "STATE" ? (scheme.state ?? "State scheme") : "All India";

  // Localize the scheme's content into the active language (cached).
  const locale = await getLocale();
  const content = await localizeScheme(scheme, locale);

  // Personalize when signed in: bookmark/application state + DigiLocker
  // have/need document matching.
  const user = await getAuthedUser();
  const userState = user
    ? await getUserSchemeState(user.id, slug)
    : {
        bookmarked: false,
        applicationStatus: null,
        completedSteps: [] as number[],
      };
  const ownedTypes = user ? await getUserDocTypes(user.id) : new Set<string>();
  const docMatch = matchDocuments(
    scheme.documents,
    ownedTypes,
    ownedTypes.size > 0,
  );

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <SchemeJsonLd scheme={scheme} url={`${base}/schemes/${slug}`} />
      <Link
        href="/schemes"
        className="eyebrow inline-flex items-center gap-1 hover:text-ink"
      >
        ← All schemes
      </Link>

      <header className="mt-4 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">
            {scheme.category ?? "Scheme"} · {place}
          </p>
          <DeadlineBadge closeDate={scheme.closeDate} />
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {content.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          {content.summary}
        </p>
        {scheme.ministry && (
          <p className="mt-3 text-sm text-muted">{scheme.ministry}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/finder?scheme=${scheme.slug}`}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-deep"
          >
            Am I eligible?
          </Link>
          {scheme.sourceUrl && (
            <a
              href={scheme.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-sunken"
            >
              Official website ↗
            </a>
          )}
        </div>
        <div className="mt-4">
          <SchemeActions
            slug={scheme.slug}
            signedIn={Boolean(user)}
            initialBookmarked={userState.bookmarked}
            initialStatus={userState.applicationStatus}
          />
        </div>
      </header>

      {content.benefits && (
        <Section title="What you get">
          <Prose text={content.benefits} />
        </Section>
      )}

      <Section title="Who is eligible">
        {scheme.rules.length === 0 ? (
          <p className="text-ink-soft">
            No specific machine-checkable criteria are listed. Check the official
            website for full eligibility details.
          </p>
        ) : (
          <ul className="space-y-2">
            {scheme.rules.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-sunken text-[0.7rem] font-semibold text-ink-soft"
                >
                  {i + 1}
                </span>
                <span className="text-ink-soft">{ruleToText(r)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {scheme.documents.length > 0 && (
        <Section title="Documents you'll need">
          {docMatch.connected && (
            <p className="mb-3 text-sm text-ink-soft">
              From your DigiLocker:{" "}
              <span className="font-semibold text-eligible">
                {docMatch.haveCount} ready
              </span>
              {docMatch.needCount > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-pending">
                    {docMatch.needCount} to arrange
                  </span>
                </>
              )}
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {docMatch.matches.map((d, i) => (
              <DocumentItem
                key={i}
                doc={d}
                connected={docMatch.connected}
              />
            ))}
          </ul>
          {!docMatch.connected && (
            <p className="mt-3 text-xs text-muted">
              Connect DigiLocker in{" "}
              <Link href="/account" className="font-semibold text-saffron-ink hover:underline">
                your account
              </Link>{" "}
              to see which of these you already have.
            </p>
          )}
        </Section>
      )}

      {scheme.steps.length > 0 && (
        <Section title="How to apply">
          <ApplicationSteps
            slug={scheme.slug}
            steps={scheme.steps}
            signedIn={Boolean(user)}
            initialCompleted={userState.completedSteps}
          />
        </Section>
      )}

      <p className="mt-10 rounded-lg bg-surface-sunken px-4 py-3 text-xs leading-relaxed text-muted">
        IndiaConnect is an independent guide. Eligibility shown here is a
        simplified, self-assessment aid — always confirm full criteria on the
        official scheme website before applying.
      </p>
    </main>
  );
}

/**
 * A required document, plus — when the citizen doesn't already have it — plain
 * guidance on how to actually obtain it. Uses <details> so it works without JS.
 */
function DocumentItem({
  doc,
  connected,
}: {
  doc: DocMatch;
  connected: boolean;
}) {
  const guide = getDocGuide(doc.digilockerDocType);
  const have = connected && doc.have;

  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        {connected && doc.checkable ? (
          <span aria-hidden className={have ? "text-eligible" : "text-denied"}>
            {have ? "✓" : "✕"}
          </span>
        ) : (
          <span aria-hidden className="text-saffron">
            ▸
          </span>
        )}
        <span className={have ? "text-ink" : ""}>{doc.name}</span>
        {have && (
          <span className="ml-auto shrink-0 text-xs font-medium text-eligible">
            In DigiLocker
          </span>
        )}
      </div>

      {!have && guide && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-saffron-ink hover:underline">
            How to get it →
          </summary>
          <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs leading-relaxed text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Issued by:</span>{" "}
              {guide.issuer}
            </p>
            <p>{guide.howTo}</p>
            {guide.timeline && (
              <p className="text-muted">⏱ {guide.timeline}</p>
            )}
            {guide.url && (
              <a
                href={guide.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-semibold text-saffron-ink hover:underline"
              >
                Official portal ↗
              </a>
            )}
          </div>
        </details>
      )}
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-6">
      <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Render lightweight markdown-ish text (myScheme benefits_md) as paragraphs. */
function Prose({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
  return (
    <div className="space-y-1.5 text-ink-soft">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}

function ruleToText(rule: {
  attribute: string;
  operator: RuleOperator;
  value: RuleValue;
  orGroup: string | null;
}): string {
  const label = getAttribute(rule.attribute)?.label ?? rule.attribute;
  const v = Array.isArray(rule.value) ? rule.value.join(" or ") : rule.value;
  const phrase: Record<RuleOperator, string> = {
    EQ: "must be",
    NEQ: "must not be",
    IN: "must be one of",
    NOT_IN: "must not be",
    LT: "must be under",
    LTE: "must be at most",
    GT: "must be over",
    GTE: "must be at least",
    BETWEEN: "must be between",
  };
  const between =
    rule.operator === "BETWEEN" && Array.isArray(rule.value)
      ? `${rule.value[0]} and ${rule.value[1]}`
      : v;
  return `${label} ${phrase[rule.operator]} ${between}`;
}
