/**
 * Backfills structured eligibility rules for schemes ingested without them.
 *
 *   npm run backfill:rules -- [--max=1400] [--batch=10] [--throttle=7000]
 *
 * Reads the stored raw eligibility text — no re-scraping of myScheme needed.
 *
 * Two things make this survivable on a free-tier quota:
 *   1. Schemes are normalized in BATCHES (one request per ~10 schemes), because
 *      the free tier caps requests-per-day, not tokens.
 *   2. Every processed scheme is stamped with `rulesNormalizedAt` — even when it
 *      yields zero rules (plenty of criteria aren't machine-checkable). Without
 *      that, repeat runs would burn quota re-processing the same dead ends.
 *
 * Safe to re-run: it only picks up schemes that have never been normalized, so
 * you can chip away at the backlog across several days.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hasGeminiKey } from "@/lib/gemini/client";
import {
  normalizeEligibilityBatch,
  type BatchItem,
} from "@/lib/gemini/normalize-eligibility";
import type { EligibilityRuleInput, RuleOperator } from "@/lib/eligibility/rules";
import type { Prisma } from "@/lib/generated/prisma/client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return raw ? Number(raw) : fallback;
}

function isQuotaExhausted(err: unknown): boolean {
  const s = String(err);
  return s.includes("429") || s.includes("RESOURCE_EXHAUSTED");
}
function isTransient(err: unknown): boolean {
  const s = String(err);
  return s.includes("503") || s.includes("UNAVAILABLE") || s.includes("500");
}

async function main() {
  if (!hasGeminiKey()) {
    console.error("GEMINI_API_KEY is not set — nothing to do.");
    process.exit(1);
  }

  const max = arg("max", 1400);
  const batchSize = arg("batch", 10);
  // Free tier is ~10 requests/minute; one request now covers `batchSize` schemes.
  const throttle = arg("throttle", 7000);

  const pending = await prisma.scheme.findMany({
    where: { eligibilityText: { not: null }, rulesNormalizedAt: null },
    select: { id: true, slug: true, eligibilityText: true },
    take: max,
  });
  const remaining = await prisma.scheme.count({
    where: { eligibilityText: { not: null }, rulesNormalizedAt: null },
  });

  if (!pending.length) {
    console.log("Nothing pending — every scheme has been normalized.");
    return;
  }

  const batches = Math.ceil(pending.length / batchSize);
  console.log(
    `Normalizing ${pending.length} of ${remaining} pending schemes in ${batches} request(s) of ${batchSize}…\n`,
  );

  let processed = 0;
  let ruled = 0;
  let rulesCreated = 0;

  for (let i = 0; i < pending.length; i += batchSize) {
    const slice = pending.slice(i, i + batchSize);
    const items: BatchItem[] = slice.map((s) => ({
      id: s.id,
      eligibilityText: s.eligibilityText!,
    }));

    let map: Map<string, EligibilityRuleInput[]>;
    try {
      map = await normalizeEligibilityBatch(items);
    } catch (err) {
      if (isQuotaExhausted(err)) {
        console.warn(
          `\n⚠ Gemini daily/rate quota exhausted after ${processed} schemes.\n  Re-run this command later — it resumes exactly where it stopped.\n`,
        );
        break;
      }
      if (isTransient(err)) {
        console.warn(`  transient error, backing off 20s…`);
        await sleep(20_000);
        i -= batchSize; // retry this batch
        continue;
      }
      console.error("Unexpected error:", String(err).slice(0, 160));
      break;
    }

    // Persist rules + stamp every scheme in the batch as processed.
    await prisma.$transaction(async (tx) => {
      for (const s of slice) {
        const rules = map.get(s.id) ?? [];

        if (rules.length) {
          await tx.eligibilityRule.deleteMany({ where: { schemeId: s.id } });
          await tx.eligibilityRule.createMany({
            data: rules.map((r) => ({
              schemeId: s.id,
              attribute: r.attribute,
              operator: r.operator as RuleOperator,
              value: r.value as Prisma.InputJsonValue,
              orGroup: r.orGroup ?? null,
              rawText: r.rawText ?? null,
            })),
          });
          ruled++;
          rulesCreated += rules.length;
        }
        await tx.scheme.update({
          where: { id: s.id },
          data: { rulesNormalizedAt: new Date() },
        });
        processed++;
      }
    });

    console.log(
      `  batch ${Math.floor(i / batchSize) + 1}/${batches} · ${processed} processed · ${ruled} gained rules (${rulesCreated} rules)`,
    );
    await sleep(throttle);
  }

  const left = await prisma.scheme.count({
    where: { eligibilityText: { not: null }, rulesNormalizedAt: null },
  });
  console.log(
    `\nDone. ${processed} processed, ${ruled} gained rules (${rulesCreated} rules total). ${left} still pending.`,
  );
  if (left > 0) {
    console.log("Re-run `npm run backfill:rules` to continue where this stopped.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
