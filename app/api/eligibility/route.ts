import { NextResponse } from "next/server";
import { z } from "zod";
import { getSchemesForMatching } from "@/lib/schemes";
import { matchSchemes, type Profile } from "@/lib/eligibility/matcher";
import { ATTRIBUTE_KEYS } from "@/lib/eligibility/attributes";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

// Partial: the finder lets users skip questions, so any subset of keys is OK.
const profileSchema = z.partialRecord(
  z.enum(ATTRIBUTE_KEYS as [string, ...string[]]),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

const bodySchema = z.object({
  profile: profileSchema,
  includeIneligible: z.boolean().optional(),
});

// Public and runs a full match over the catalog — capped, but generously, since
// the finder legitimately calls it as people work through the questionnaire.
const LIMIT = Number(process.env.ELIGIBILITY_RATE_LIMIT ?? 60);

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, "eligibility"), LIMIT, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Scope state schemes to the citizen's own state — a Bihar resident can't
  // claim a Gujarat scheme.
  const profileState = parsed.data.profile.state;
  const schemes = await getSchemesForMatching(
    typeof profileState === "string" ? profileState : undefined,
  );
  const meta = new Map(
    schemes.map((s) => [s.slug, { summary: s.summary, category: s.category }]),
  );

  const results = matchSchemes(schemes, parsed.data.profile as Profile, {
    includeIneligible: parsed.data.includeIneligible ?? false,
  });

  return NextResponse.json({
    count: results.length,
    results: results.map((r) => ({
      ...r,
      summary: meta.get(r.slug)?.summary ?? "",
      category: meta.get(r.slug)?.category ?? null,
    })),
  });
}
