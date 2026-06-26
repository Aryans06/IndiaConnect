import type { Metadata } from "next";
import Link from "next/link";
import { getSchemes, getCategories } from "@/lib/schemes";
import { SchemeCard } from "@/components/scheme-card";

export const metadata: Metadata = {
  title: "All schemes",
  description:
    "Browse government welfare schemes by category, with eligibility, documents, and how to apply.",
};

export default async function SchemesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const [schemes, categories] = await Promise.all([
    getSchemes({ q, category }),
    getCategories(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
      <p className="eyebrow">The register</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Government schemes directory
      </h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Every scheme in plain language — what you get, who qualifies, and the
        documents you need. Not sure where to start?{" "}
        <Link href="/finder" className="font-semibold text-saffron-ink underline-offset-2 hover:underline">
          Check your eligibility
        </Link>
        .
      </p>

      {/* Search */}
      <form className="mt-6 flex gap-2" action="/schemes">
        {category && <input type="hidden" name="category" value={category} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search schemes, e.g. pension, scholarship, housing…"
          className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/20"
        />
        <button
          type="submit"
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft"
        >
          Search
        </button>
      </form>

      {/* Category filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <CategoryChip label="All" href={buildHref(q, undefined)} active={!category} />
        {categories.map((c) => (
          <CategoryChip
            key={c}
            label={c}
            href={buildHref(q, c)}
            active={category === c}
          />
        ))}
      </div>

      {/* Results */}
      <p className="eyebrow mt-8">
        {schemes.length} scheme{schemes.length === 1 ? "" : "s"}
        {category ? ` in ${category}` : ""}
        {q ? ` matching “${q}”` : ""}
      </p>

      {schemes.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-display text-lg font-semibold">No schemes found</p>
          <p className="mt-1 text-sm text-ink-soft">
            Try a different search term or clear the filters.
          </p>
          <Link
            href="/schemes"
            className="mt-4 inline-block text-sm font-semibold text-saffron-ink hover:underline"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schemes.map((s) => (
            <SchemeCard key={s.slug} scheme={s} />
          ))}
        </div>
      )}
    </main>
  );
}

function buildHref(q?: string, category?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/schemes?${qs}` : "/schemes";
}

function CategoryChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full border border-ink bg-ink px-3.5 py-1.5 text-xs font-semibold text-white"
          : "rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}
