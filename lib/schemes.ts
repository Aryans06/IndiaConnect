/**
 * Read-side queries for schemes. The directory, detail pages, and finder all
 * go through here so the DB shape is mapped to the app's view models in one
 * place.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { searchSchemeIds } from "@/lib/search";
import type { SchemeLike } from "@/lib/eligibility/matcher";
import type { RuleOperator, RuleValue } from "@/lib/eligibility/rules";

export interface SchemeListEntry {
  slug: string;
  title: string;
  summary: string;
  ministry: string | null;
  category: string | null;
  level: "CENTRAL" | "STATE";
  state: string | null;
  closeDate: Date | null;
}

export interface DirectoryFilters {
  q?: string;
  category?: string;
  /** State name; also matches central ("All India") schemes, which apply everywhere. */
  state?: string;
  level?: "CENTRAL" | "STATE";
  /** "closing" surfaces schemes with the nearest application deadline first. */
  sort?: "default" | "closing";
  page?: number;
  perPage?: number;
}

export const DEFAULT_PER_PAGE = 24;

function buildWhere(filters: DirectoryFilters) {
  const and: Prisma.SchemeWhereInput[] = [];

  if (filters.category) and.push({ category: filters.category });
  if (filters.level) and.push({ level: filters.level });

  // Picking a state shows that state's schemes AND central ones (which apply
  // to everyone) — a citizen cares about what they can get, not who funds it.
  if (filters.state) {
    and.push({
      OR: [{ state: filters.state }, { level: "CENTRAL" }],
    });
  }

  // NB: the free-text term is NOT handled here — it goes through Postgres
  // full-text search (see getSchemes), which ranks by relevance instead of doing
  // an unindexed substring scan across thousands of rows.

  // "Closing soon" means schemes you can still apply to — surfacing already
  // expired ones first would be worse than not sorting at all.
  if (filters.sort === "closing") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    and.push({ closeDate: { gte: startOfToday } });
  }

  return and.length ? { AND: and } : {};
}

export interface SchemePage {
  schemes: SchemeListEntry[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const LIST_SELECT = {
  slug: true,
  title: true,
  summary: true,
  ministry: true,
  category: true,
  level: true,
  state: true,
  closeDate: true,
} as const;

export async function getSchemes(
  filters: DirectoryFilters = {},
): Promise<SchemePage> {
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;
  const page = Math.max(1, filters.page ?? 1);

  // Search path: rank candidates with Postgres FTS, then apply the structured
  // filters. Relevance order is preserved, so the best match is genuinely first.
  if (filters.q?.trim()) {
    return searchPage(filters, page, perPage);
  }

  const where = buildWhere(filters);
  const orderBy: Prisma.SchemeOrderByWithRelationInput[] =
    filters.sort === "closing"
      ? // Nearest deadline first; schemes with no deadline sink to the bottom.
        [{ closeDate: { sort: "asc", nulls: "last" } }, { title: "asc" }]
      : // Central schemes first (they apply to everyone), then alphabetical.
        [{ level: "asc" }, { title: "asc" }];

  const [rows, total] = await Promise.all([
    prisma.scheme.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: LIST_SELECT,
    }),
    prisma.scheme.count({ where }),
  ]);

  return {
    schemes: rows,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Full-text search + structured filters, ordered by relevance. */
async function searchPage(
  filters: DirectoryFilters,
  page: number,
  perPage: number,
): Promise<SchemePage> {
  const hits = await searchSchemeIds(filters.q!, 500);
  if (!hits.length) {
    return { schemes: [], total: 0, page, perPage, totalPages: 1 };
  }

  const rank = new Map(hits.map((h, i) => [h.id, i]));
  const where = {
    AND: [{ id: { in: hits.map((h) => h.id) } }, buildWhere(filters)],
  };

  const matched = await prisma.scheme.findMany({
    where,
    select: { ...LIST_SELECT, id: true },
  });

  // Restore FTS relevance order (an `IN (...)` query gives no ordering).
  matched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  const total = matched.length;
  const start = (page - 1) * perPage;
  const schemes = matched
    .slice(start, start + perPage)
    .map(({ id: _id, ...rest }) => rest);

  return {
    schemes,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Distinct states that actually have schemes (for the filter dropdown). */
export async function getStates(): Promise<string[]> {
  const rows = await prisma.scheme.findMany({
    where: { state: { not: null }, level: "STATE" },
    distinct: ["state"],
    select: { state: true },
    orderBy: { state: "asc" },
  });
  return rows.map((r) => r.state!).filter(Boolean);
}

export async function getCategories(): Promise<string[]> {
  const rows = await prisma.scheme.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category!).filter(Boolean);
}

export interface SchemeDetailView extends SchemeListEntry {
  benefits: string | null;
  howToApply: string | null;
  sourceUrl: string | null;
  translations: unknown;
  rules: { attribute: string; operator: RuleOperator; value: RuleValue; orGroup: string | null }[];
  documents: { name: string; digilockerDocType: string | null }[];
  steps: { order: number; instruction: string }[];
}

export async function getSchemeBySlug(
  slug: string,
): Promise<SchemeDetailView | null> {
  const s = await prisma.scheme.findUnique({
    where: { slug },
    include: {
      eligibilityRules: true,
      requiredDocuments: true,
      applicationSteps: { orderBy: { order: "asc" } },
    },
  });
  if (!s) return null;
  return {
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    ministry: s.ministry,
    category: s.category,
    level: s.level,
    state: s.state,
    closeDate: s.closeDate,
    benefits: s.benefits,
    howToApply: s.howToApply,
    sourceUrl: s.sourceUrl,
    translations: s.translations,
    rules: s.eligibilityRules.map((r) => ({
      attribute: r.attribute,
      operator: r.operator as RuleOperator,
      value: r.value as RuleValue,
      orGroup: r.orGroup,
    })),
    documents: s.requiredDocuments.map((d) => ({
      name: d.name,
      digilockerDocType: d.digilockerDocType,
    })),
    steps: s.applicationSteps.map((st) => ({
      order: st.order,
      instruction: st.instruction,
    })),
  };
}

/**
 * Schemes that can actually be matched, shaped for the eligibility matcher.
 *
 * Only schemes that have at least one structured rule are returned. This is a
 * correctness guard, not an optimisation: the matcher treats "no rules" as
 * "open to everyone", which was true of the hand-curated set but is badly wrong
 * for scraped schemes whose criteria simply haven't been normalized yet. Without
 * this filter a farmer is told they qualify for thousands of schemes we know
 * nothing about — claiming eligibility with no evidence, which is the precise
 * harm this app exists to prevent. Un-normalized schemes stay fully browsable in
 * the directory; they just don't assert a match.
 *
 * When the citizen's state is known, state schemes from *other* states are
 * excluded — a citizen in Bihar can't claim a Gujarat scheme. Central schemes
 * always apply.
 */
export async function getSchemesForMatching(
  state?: string | null,
): Promise<(SchemeLike & { summary: string; category: string | null })[]> {
  const rows = await prisma.scheme.findMany({
    where: {
      eligibilityRules: { some: {} },
      ...(state ? { OR: [{ level: "CENTRAL" }, { state }] } : {}),
    },
    include: { eligibilityRules: true },
    orderBy: { title: "asc" },
  });
  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    category: s.category,
    rules: s.eligibilityRules.map((r) => ({
      attribute: r.attribute,
      operator: r.operator as RuleOperator,
      value: r.value as RuleValue,
      orGroup: r.orGroup,
    })),
  }));
}
