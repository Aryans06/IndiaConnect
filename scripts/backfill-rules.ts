/**
 * Backfills structured eligibility rules for schemes that were ingested without
 * them (e.g. Gemini quota was unavailable during the scrape).
 *
 *   npm run backfill:rules -- [--max=200] [--throttle=1200]
 *
 * Reads the stored raw eligibility text — no re-scraping of myScheme needed.
 * Safe to re-run: it only touches schemes that still have zero rules, so it can
 * be run repeatedly to chip away at the backlog within a free-tier quota.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hasGeminiKey } from "@/lib/gemini/client";
import { normalizeEligibility } from "@/lib/gemini/normalize-eligibility";
import type { Prisma } from "@/lib/generated/prisma/client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient Gemini failures (503 overloaded, 429 rate-limit) deserve a retry. */
function isTransient(err: unknown): boolean {
  const s = String(err);
  return s.includes("503") || s.includes("429") || s.includes("UNAVAILABLE");
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err;
      // Exponential backoff: 5s, 10s, 20s.
      await sleep(5000 * 2 ** attempt);
    }
  }
}

function arg(name: string, fallback: number): number {
  const raw = process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")[1];
  return raw ? Number(raw) : fallback;
}

async function main() {
  if (!hasGeminiKey()) {
    console.error("GEMINI_API_KEY is not set — nothing to do.");
    process.exit(1);
  }

  const max = arg("max", 200);
  // Free-tier friendly by default: ~50 requests/minute.
  const throttle = arg("throttle", 1200);

  const pending = await prisma.scheme.findMany({
    where: {
      eligibilityText: { not: null },
      eligibilityRules: { none: {} },
    },
    select: { id: true, slug: true, eligibilityText: true },
    take: max,
  });

  const remaining = await prisma.scheme.count({
    where: {
      eligibilityText: { not: null },
      eligibilityRules: { none: {} },
    },
  });

  console.log(
    `Backfilling ${pending.length} of ${remaining} schemes still missing rules…\n`,
  );

  let done = 0;
  let ruled = 0;
  let failed = 0;

  for (const scheme of pending) {
    try {
      const rules = await withRetry(() =>
        normalizeEligibility(scheme.eligibilityText!),
      );
      if (rules.length) {
        await prisma.eligibilityRule.createMany({
          data: rules.map((r) => ({
            schemeId: scheme.id,
            attribute: r.attribute,
            operator: r.operator,
            value: r.value as Prisma.InputJsonValue,
            orGroup: r.orGroup ?? null,
            rawText: r.rawText ?? null,
          })),
        });
        ruled++;
      }
      done++;
      console.log(`✓ ${scheme.slug} (${rules.length} rules)`);
    } catch (err) {
      failed++;
      console.warn(`✗ ${scheme.slug}: ${String(err).slice(0, 120)}`);
      // Quota errors will keep failing — bail out early rather than burn time.
      if (failed >= 5 && ruled === 0) {
        console.error(
          "\nGemini is failing consistently (likely quota). Stopping.\n",
        );
        break;
      }
    }
    await sleep(throttle);
  }

  console.log(
    `\nDone. ${done} processed, ${ruled} gained rules, ${failed} failed. ${Math.max(0, remaining - ruled)} still pending.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
