/**
 * Ingest pipeline: scrape myScheme → normalize eligibility with Gemini → store.
 *
 *   npm run ingest -- [--max=50] [--concurrency=4] [--throttle=150] [--no-rules]
 *
 * Idempotent (upsert by slug) and re-runnable. Runtime never depends on this —
 * it only populates our DB.
 *
 * Eligibility rules require GEMINI_API_KEY. If the key is missing, or Gemini
 * starts failing (e.g. quota exhausted), a circuit breaker trips and the rest
 * of the run ingests schemes WITHOUT structured rules — they stay browsable and
 * searchable, and rules can be backfilled later with `npm run backfill:rules`.
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
  concurrency: number;
  throttle: number;
  noRules: boolean;
  /** Re-fetch schemes we already have (default: skip them, so runs resume). */
  refresh: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const max = get("max");
  return {
    max: max ? Number(max) : undefined,
    // myScheme rate-limits hard; these defaults are deliberately polite.
    concurrency: Number(get("concurrency") ?? 2),
    throttle: Number(get("throttle") ?? 400),
    noRules: argv.includes("--no-rules"),
    refresh: argv.includes("--refresh"),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Trips after repeated Gemini failures so one bad key doesn't stall the run. */
class CircuitBreaker {
  private failures = 0;
  private tripped = false;
  constructor(private threshold = 3) {}

  get open() {
    return this.tripped;
  }
  recordSuccess() {
    this.failures = 0;
  }
  recordFailure(reason: string) {
    this.failures++;
    if (!this.tripped && this.failures >= this.threshold) {
      this.tripped = true;
      console.warn(
        `\n⚠ Gemini failing (${this.failures}x) — disabling rule normalization for the rest of this run.\n  Reason: ${reason.slice(0, 140)}\n  Schemes will still be ingested; backfill rules later once quota is available.\n`,
      );
    }
  }
}

async function toNormalized(
  detail: SchemeDetail,
  breaker: CircuitBreaker,
  useGemini: boolean,
): Promise<NormalizedScheme> {
  let rules: NormalizedScheme["rules"] = [];

  if (useGemini && !breaker.open && detail.eligibilityMd) {
    try {
      const normalized = await normalizeEligibility(detail.eligibilityMd);
      rules = normalized.map((r) => ({
        attribute: r.attribute,
        operator: r.operator,
        value: r.value,
        orGroup: r.orGroup ?? null,
        rawText: r.rawText ?? null,
      }));
      breaker.recordSuccess();
    } catch (err) {
      breaker.recordFailure(String(err));
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
    eligibilityText: detail.eligibilityMd ?? null,
    openDate: detail.openDate ?? null,
    closeDate: detail.closeDate ?? null,
    rules,
    // myScheme's detail payload has no clean documents/steps list; the curated
    // seed supplies those for the headline schemes. Left empty here by design.
    documents: [],
    steps: [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const useGemini = !args.noRules && hasGeminiKey();

  console.log(
    `Ingest starting (max=${args.max ?? "all"}, concurrency=${args.concurrency}, throttle=${args.throttle}ms, rules=${useGemini ? "on" : "off"})`,
  );

  const breaker = new CircuitBreaker();
  const stats = { ok: 0, withRules: 0, failed: 0 };

  // Collect the slug list first so we can report progress against a total.
  const all: string[] = [];
  for await (const item of listSchemes({
    pageSize: 100,
    max: args.max,
    throttleMs: args.throttle,
  })) {
    if (item.slug) all.push(item.slug);
  }

  // Resume support: skip what we already fetched, so a rate-limited run can
  // simply be re-run to fill in the gaps instead of starting over.
  let items = all.map((slug) => ({ slug }));
  if (!args.refresh) {
    const existing = await prisma.scheme.findMany({
      where: { slug: { in: all }, eligibilityText: { not: null } },
      select: { slug: true },
    });
    const have = new Set(existing.map((s) => s.slug));
    items = items.filter((i) => !have.has(i.slug));
    console.log(
      `Found ${all.length} schemes; ${have.size} already stored, ${items.length} to fetch.`,
    );
  } else {
    console.log(`Found ${all.length} schemes (refreshing all).`);
  }
  if (!items.length) {
    console.log("Nothing to do.");
    return;
  }
  console.log("");

  // Bounded-concurrency worker pool.
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      const { slug } = items[i];
      try {
        const detail = await getSchemeDetail(slug);
        if (!detail) {
          stats.failed++;
        } else {
          const normalized = await toNormalized(detail, breaker, useGemini);
          await upsertScheme(normalized);
          stats.ok++;
          if (normalized.rules.length) stats.withRules++;
        }
      } catch (err) {
        stats.failed++;
        if (stats.failed <= 5) console.warn(`✗ ${slug}: ${String(err).slice(0, 100)}`);
      }
      const done = stats.ok + stats.failed;
      if (done % 50 === 0 || done === items.length) {
        console.log(
          `  ${done}/${items.length} · ${stats.ok} stored · ${stats.withRules} with rules · ${stats.failed} failed`,
        );
      }
      await sleep(args.throttle);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, args.concurrency) }, worker),
  );

  console.log(
    `\nDone. ${stats.ok} schemes ingested (${stats.withRules} with structured rules, ${stats.failed} failed).`,
  );
  if (!useGemini || breaker.open) {
    console.log(
      "Rules were not normalized. Once GEMINI_API_KEY has quota, run: npm run backfill:rules",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
