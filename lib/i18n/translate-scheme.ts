/**
 * Localizes scheme content (title / summary / benefits) into the active locale,
 * caching results in Scheme.translations so each scheme+language is translated
 * exactly once — which keeps this affordable on a free-tier quota.
 *
 * The translator itself (Gemini or Bhashini) is chosen in lib/translate. When
 * none is configured, content falls back to English and the app stays fully
 * usable.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { translateBatch, canTranslate } from "@/lib/translate";
import type { Locale } from "./config";

export interface LocalizedContent {
  title: string;
  summary: string;
  benefits: string | null;
}

type Cache = Record<string, LocalizedContent>;

export async function localizeScheme(
  scheme: {
    slug: string;
    title: string;
    summary: string;
    benefits: string | null;
    translations?: unknown;
  },
  locale: Locale,
): Promise<LocalizedContent> {
  const english: LocalizedContent = {
    title: scheme.title,
    summary: scheme.summary,
    benefits: scheme.benefits,
  };
  if (locale === "en") return english;

  const cache = (scheme.translations as Cache | null) ?? {};
  if (cache[locale]) return cache[locale];

  if (!canTranslate()) return english;

  const [title, summary, benefits] = await translateBatch(
    [scheme.title, scheme.summary, scheme.benefits ?? ""],
    locale,
  );
  const localized: LocalizedContent = {
    title,
    summary,
    benefits: scheme.benefits ? benefits : null,
  };

  // Persist to the per-scheme translation cache (best-effort).
  try {
    await prisma.scheme.update({
      where: { slug: scheme.slug },
      data: {
        translations: { ...cache, [locale]: localized } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Non-fatal — return the translation even if caching fails.
  }
  return localized;
}
