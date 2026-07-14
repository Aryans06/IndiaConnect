/**
 * Full-text search over the scheme catalog.
 *
 * Both the directory and the assistant's retrieval used to scan/`ILIKE` their
 * way through every scheme — the assistant literally loaded the entire catalog
 * into memory on each request. That's fine at 20 schemes and unusable at 4,000.
 *
 * Postgres' built-in FTS does the work in the database against a GIN index, and
 * ranks results by relevance (title matches outweigh summary matches, etc. — see
 * the setweight() calls in the migration).
 */
import { prisma } from "@/lib/db";

/**
 * Turn a user's free-text query into a tsquery.
 *
 * `plainto_tsquery` would AND every word, so "old age pension bihar" finds
 * nothing. We OR the terms and prefix-match the last one, which behaves the way
 * people expect from a search box, and let ts_rank sort out relevance.
 */
export function toTsQuery(raw: string): string | null {
  const terms = raw
    .toLowerCase()
    // Keep marks (\p{M}) as well as letters/numbers: Indic vowel signs like the
    // "े" in "पेंशन" are combining marks, and stripping them shreds the word.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (!terms.length) return null;
  // Prefix-match every term so "pens" matches "pension".
  return terms.map((t) => `${t}:*`).join(" | ");
}

export interface SearchHit {
  id: string;
  rank: number;
}

/**
 * Rank scheme ids by relevance to `query`. Returns [] for an empty query.
 * `limit` caps how many candidates come back.
 */
export async function searchSchemeIds(
  query: string,
  limit = 200,
): Promise<SearchHit[]> {
  const ts = toTsQuery(query);
  if (!ts) return [];

  const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT id, ts_rank("searchVector", to_tsquery('english', ${ts})) AS rank
    FROM "Scheme"
    WHERE "searchVector" @@ to_tsquery('english', ${ts})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ id: r.id, rank: Number(r.rank) }));
}
