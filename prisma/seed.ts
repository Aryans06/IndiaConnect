/**
 * Seeds the curated fallback schemes. Safe to re-run (idempotent upserts).
 *   npm run db:seed
 */
import { CURATED_SCHEMES } from "./curated-schemes";
import { upsertScheme } from "@/lib/scheme-store";
import { eligibilityRuleArraySchema } from "@/lib/eligibility/rules";

async function main() {
  console.log(`Seeding ${CURATED_SCHEMES.length} curated schemes…`);
  let ok = 0;
  for (const scheme of CURATED_SCHEMES) {
    // Validate rules before persisting — bad curated data should fail loudly.
    const parsed = eligibilityRuleArraySchema.safeParse(scheme.rules);
    if (!parsed.success) {
      console.error(`✗ ${scheme.slug}: invalid rules`, parsed.error.issues);
      continue;
    }
    await upsertScheme({
      ...scheme,
      rules: scheme.rules.map((r) => ({ ...r, orGroup: r.orGroup ?? null })),
    });
    ok++;
    console.log(`✓ ${scheme.slug}`);
  }
  console.log(`Done. ${ok}/${CURATED_SCHEMES.length} schemes seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  });
