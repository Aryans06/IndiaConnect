/**
 * Localizes scheme content (title / summary / benefits) into the active locale
 * via Bhashini, caching results in Scheme.translations so each scheme+language
 * is only ever translated once. Falls back to English when Bhashini isn't
 * configured — the app stays fully usable, just in English content.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { translateBatch, hasBhashini } from "@/lib/bhashini/client";
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

  if (!hasBhashini()) return english;

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
