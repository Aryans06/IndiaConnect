/**
 * Ingest pipeline: scrape myScheme → normalize eligibility with Gemini → store.
 *
 *   npm run ingest -- [--max=50] [--page-size=100] [--throttle=500]
 *
 * Idempotent (upsert by slug) and re-runnable. Requires GEMINI_API_KEY for rule
 * normalization; without it, schemes are still ingested but with no structured
 * eligibility rules (they'll show in the directory but not match in the finder).
 * Runtime never depends on this — it only populates our DB.
 */
import "dotenv/config";
import {
  listSchemes,
  getSchemeDetail,
  type SchemeDetail,
} from "@/lib/myscheme/client";
import { normalizeEligibility } from "@/lib/gemini/normalize-eligibility";
import { upsertScheme, type NormalizedScheme } from "@/lib/scheme-store";
import { hasGeminiKey } from "@/lib/gemini/client";
import { prisma } from "@/lib/db";

interface Args {
  max?: number;
  pageSize: number;
  throttle: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const max = get("max");
  return {
    max: max ? Number(max) : undefined,
    pageSize: Number(get("page-size") ?? 100),
    throttle: Number(get("throttle") ?? 500),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function toNormalized(detail: SchemeDetail): Promise<NormalizedScheme> {
  let rules: NormalizedScheme["rules"] = [];
  if (detail.eligibilityMd && hasGeminiKey()) {
    try {
      const normalized = await normalizeEligibility(detail.eligibilityMd);
      rules = normalized.map((r) => ({
        attribute: r.attribute,
        operator: r.operator,
        value: r.value,
        orGroup: r.orGroup ?? null,
        rawText: r.rawText ?? null,
      }));
    } catch (err) {
      console.warn(`  ⚠ normalize failed for ${detail.slug}:`, String(err));
    }
  }

  return {
    slug: detail.slug,
    title: detail.title,
    ministry: detail.ministry,
    category: detail.category,
    level: detail.level,
    state: detail.state,
    summary: detail.summary || detail.title,
    benefits: detail.benefitsMd,
    sourceUrl: `https://www.myscheme.gov.in/schemes/${detail.slug}`,
    rules,
    // myScheme detail doesn't expose a clean documents/steps list; the curated
    // seed covers those for the headline schemes. Left empty here by design.
    documents: [],
    steps: [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `Ingest starting (max=${args.max ?? "all"}, pageSize=${args.pageSize}, throttle=${args.throttle}ms)`,
  );
  if (!hasGeminiKey()) {
    console.warn(
      "⚠ GEMINI_API_KEY not set — schemes will ingest WITHOUT structured eligibility rules.",
    );
  }

  let count = 0;
  let withRules = 0;
  let failed = 0;

  for await (const item of listSchemes({
    pageSize: args.pageSize,
    max: args.max,
    throttleMs: args.throttle,
  })) {
    if (!item.slug) continue;
    try {
      const detail = await getSchemeDetail(item.slug);
      if (!detail) {
        console.warn(`  – no detail for ${item.slug}, skipping`);
        continue;
      }
      const normalized = await toNormalized(detail);
      await upsertScheme(normalized);
      count++;
      if (normalized.rules.length) withRules++;
      console.log(
        `✓ ${item.slug} (${normalized.rules.length} rule${normalized.rules.length === 1 ? "" : "s"}) [${count}]`,
      );
    } catch (err) {
      failed++;
      console.warn(`✗ ${item.slug}:`, String(err));
    }
    await sleep(args.throttle);
  }

  console.log(
    `\nDone. ${count} schemes ingested (${withRules} with structured rules, ${failed} failed).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
