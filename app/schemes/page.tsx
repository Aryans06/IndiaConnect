import type { Metadata } from "next";
import Link from "next/link";
import { getSchemes, getCategories, getStates } from "@/lib/schemes";
import { SchemeCard } from "@/components/scheme-card";
import { getAuthedUser } from "@/lib/auth";
import { getProfile } from "@/lib/account";

export const metadata: Metadata = {
  title: "All schemes",
  description:
    "Browse government welfare schemes by category and state, with eligibility, documents, and how to apply.",
};

interface Search {
  q?: string;
  category?: string;
  state?: string;
  sort?: string;
  page?: string;
}

export default async function SchemesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  // Default the state filter to the citizen's own state when we know it.
  const user = await getAuthedUser();
  const profile = user ? await getProfile(user.id) : null;
  const state = sp.state ?? profile?.state ?? undefined;

  const sort = sp.sort === "closing" ? "closing" : "default";

  const [result, categories, states] = await Promise.all([
    getSchemes({ q: sp.q, category: sp.category, state, sort, page }),
    getCategories(),
    getStates(),
  ]);

  const { schemes, total, totalPages } = result;
  const href = (over: Partial<Search>) => buildHref({ ...sp, state, ...over });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
      <p className="eyebrow">The register</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Government schemes directory
      </h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Every scheme in plain language — what you get, who qualifies, and the
        documents you need. Not sure where to start?{" "}
        <Link
          href="/finder"
          className="font-semibold text-saffron-ink underline-offset-2 hover:underline"
        >
          Check your eligibility
        </Link>
        .
      </p>

      {/* Search + state */}
      <form className="mt-6 flex flex-wrap gap-2" action="/schemes">
        {sp.category && (
          <input type="hidden" name="category" value={sp.category} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={sp.q}
          placeholder="Search schemes, e.g. pension, scholarship, housing…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/20"
        />
        {states.length > 0 && (
          <select
            name="state"
            defaultValue={state ?? ""}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-saffron"
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft"
        >
          Search
        </button>
      </form>

      {/* Category filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip
          label="All"
          href={href({ category: undefined, page: undefined })}
          active={!sp.category}
        />
        {categories.map((c) => (
          <Chip
            key={c}
            label={c}
            href={href({ category: c, page: undefined })}
            active={sp.category === c}
          />
        ))}
      </div>

      {/* Sort */}
      <div className="mt-4 flex items-center gap-2">
        <span className="eyebrow">Sort</span>
        <Chip
          label="Default"
          href={href({ sort: undefined, page: undefined })}
          active={sort === "default"}
        />
        <Chip
          label="⏳ Closing soon"
          href={href({ sort: "closing", page: undefined })}
          active={sort === "closing"}
        />
      </div>

      {/* Results */}
      <p className="eyebrow mt-8">
        {total} scheme{total === 1 ? "" : "s"}
        {sp.category ? ` in ${sp.category}` : ""}
        {state ? ` for ${state}` : ""}
        {sp.q ? ` matching “${sp.q}”` : ""}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
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

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2">
          <PageLink
            href={href({ page: String(page - 1) })}
            disabled={page <= 1}
            label="← Previous"
          />
          <span className="px-3 font-mono text-xs text-muted">
            {page} / {totalPages}
          </span>
          <PageLink
            href={href({ page: String(page + 1) })}
            disabled={page >= totalPages}
            label="Next →"
          />
        </nav>
      )}
    </main>
  );
}

function buildHref(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/schemes?${qs}` : "/schemes";
}

function Chip({
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

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-sunken"
    >
      {label}
    </Link>
  );
}
