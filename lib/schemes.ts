/**
 * Read-side queries for schemes. The directory, detail pages, and finder all
 * go through here so the DB shape is mapped to the app's view models in one
 * place.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
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
}

export interface DirectoryFilters {
  q?: string;
  category?: string;
  /** State name; also matches central ("All India") schemes, which apply everywhere. */
  state?: string;
  level?: "CENTRAL" | "STATE";
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

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { summary: { contains: filters.q, mode: "insensitive" } },
        { ministry: { contains: filters.q, mode: "insensitive" } },
      ],
    });
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

export async function getSchemes(
  filters: DirectoryFilters = {},
): Promise<SchemePage> {
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.scheme.findMany({
      where,
      // Central schemes first (they apply to everyone), then alphabetical.
      orderBy: [{ level: "asc" }, { title: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        slug: true,
        title: true,
        summary: true,
        ministry: true,
        category: true,
        level: true,
        state: true,
      },
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

/** All schemes with their rules, shaped for the eligibility matcher. */
export async function getSchemesForMatching(): Promise<
  (SchemeLike & { summary: string; category: string | null })[]
> {
  const rows = await prisma.scheme.findMany({
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
