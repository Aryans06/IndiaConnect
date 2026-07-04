/**
 * Read-side queries for schemes. The directory, detail pages, and finder all
 * go through here so the DB shape is mapped to the app's view models in one
 * place.
 */
import { prisma } from "@/lib/db";
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
}

export async function getSchemes(
  filters: DirectoryFilters = {},
): Promise<SchemeListEntry[]> {
  const rows = await prisma.scheme.findMany({
    where: {
      category: filters.category || undefined,
      OR: filters.q
        ? [
            { title: { contains: filters.q, mode: "insensitive" } },
            { summary: { contains: filters.q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { title: "asc" },
    select: {
      slug: true,
      title: true,
      summary: true,
      ministry: true,
      category: true,
      level: true,
      state: true,
    },
  });
  return rows;
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
