/**
 * Single write-path for persisting a normalized scheme + its rules, documents,
 * and steps. Used by both the curated seed and the myScheme ingest pipeline so
 * there is exactly one place that knows how schemes are stored.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { RuleOperator, RuleValue } from "@/lib/eligibility/rules";

export interface NormalizedScheme {
  slug: string;
  title: string;
  ministry?: string | null;
  category?: string | null;
  level: "CENTRAL" | "STATE";
  state?: string | null;
  summary: string;
  benefits?: string | null;
  howToApply?: string | null;
  sourceUrl?: string | null;
  rules: {
    attribute: string;
    operator: RuleOperator;
    value: RuleValue;
    orGroup?: string | null;
    rawText?: string | null;
  }[];
  documents: { name: string; digilockerDocType?: string | null }[];
  steps: string[];
}

/**
 * Idempotent upsert keyed by slug. Children (rules/docs/steps) are fully
 * replaced so re-running ingest or seed converges to the latest definition.
 */
export async function upsertScheme(scheme: NormalizedScheme) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.scheme.upsert({
      where: { slug: scheme.slug },
      create: {
        slug: scheme.slug,
        title: scheme.title,
        ministry: scheme.ministry ?? null,
        category: scheme.category ?? null,
        level: scheme.level,
        state: scheme.state ?? null,
        summary: scheme.summary,
        benefits: scheme.benefits ?? null,
        howToApply: scheme.howToApply ?? null,
        sourceUrl: scheme.sourceUrl ?? null,
      },
      update: {
        title: scheme.title,
        ministry: scheme.ministry ?? null,
        category: scheme.category ?? null,
        level: scheme.level,
        state: scheme.state ?? null,
        summary: scheme.summary,
        benefits: scheme.benefits ?? null,
        howToApply: scheme.howToApply ?? null,
        sourceUrl: scheme.sourceUrl ?? null,
      },
    });

    // Replace children so the scheme converges to this definition.
    await tx.eligibilityRule.deleteMany({ where: { schemeId: saved.id } });
    await tx.requiredDocument.deleteMany({ where: { schemeId: saved.id } });
    await tx.applicationStep.deleteMany({ where: { schemeId: saved.id } });

    if (scheme.rules.length) {
      await tx.eligibilityRule.createMany({
        data: scheme.rules.map((r) => ({
          schemeId: saved.id,
          attribute: r.attribute,
          operator: r.operator,
          value: r.value as Prisma.InputJsonValue,
          orGroup: r.orGroup ?? null,
          rawText: r.rawText ?? null,
        })),
      });
    }
    if (scheme.documents.length) {
      await tx.requiredDocument.createMany({
        data: scheme.documents.map((d) => ({
          schemeId: saved.id,
          name: d.name,
          digilockerDocType: d.digilockerDocType ?? null,
        })),
      });
    }
    if (scheme.steps.length) {
      await tx.applicationStep.createMany({
        data: scheme.steps.map((instruction, i) => ({
          schemeId: saved.id,
          order: i + 1,
          instruction,
        })),
      });
    }

    return saved;
  });
}
