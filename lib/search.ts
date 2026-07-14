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

function terms(raw: string): string[] {
  return raw
    .toLowerCase()
    // Keep marks (\p{M}) as well as letters/numbers: Indic vowel signs like the
    // "े" in "पेंशन" are combining marks, and stripping them shreds the word.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Turn a user's free-text query into a tsquery.
 *
 * `mode: "all"` requires every term (precision — "farmer loan" should mean
 * farming AND lending, not any scheme mentioning a loan). `mode: "any"` is the
 * fallback for when that's too strict and returns nothing. Terms are
 * prefix-matched so "pens" finds "pension".
 */
export function toTsQuery(
  raw: string,
  mode: "all" | "any" = "all",
): string | null {
  const t = terms(raw);
  if (!t.length) return null;
  return t.map((x) => `${x}:*`).join(mode === "all" ? " & " : " | ");
}

export interface SearchHit {
  id: string;
  rank: number;
}

/**
 * Rank scheme ids by relevance to `query`. Returns [] for an empty query.
 * `limit` caps how many candidates come back.
 */
async function runQuery(ts: string, limit: number): Promise<SearchHit[]> {
  const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT id, ts_rank("searchVector", to_tsquery('english', ${ts})) AS rank
    FROM "Scheme"
    WHERE "searchVector" @@ to_tsquery('english', ${ts})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ id: r.id, rank: Number(r.rank) }));
}

/**
 * Rank scheme ids by relevance to `query`.
 *
 * Requires ALL terms first, so "farmer loan" means farming AND lending rather
 * than any scheme that happens to mention a loan. Only if that returns nothing
 * do we loosen to ANY term, so a query still degrades to useful results instead
 * of an empty page.
 */
export async function searchSchemeIds(
  query: string,
  limit = 200,
): Promise<SearchHit[]> {
  const all = toTsQuery(query, "all");
  if (!all) return [];

  const strict = await runQuery(all, limit);
  if (strict.length) return strict;

  const any = toTsQuery(query, "any");
  return any ? runQuery(any, limit) : [];
}
