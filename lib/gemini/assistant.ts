/**
 * Grounded scheme assistant.
 *
 * Retrieval-augmented: we first retrieve the schemes most relevant to the
 * question (keyword scoring over our catalog, optionally boosted by the user's
 * eligibility matches), then ask Gemini to answer using ONLY those schemes.
 * This keeps answers grounded in real data — Gemini phrases and guides, it does
 * not invent schemes, amounts, or eligibility.
 *
 * Retrieval is keyword-based, which is plenty for the curated catalog. At scrape
 * scale, swap `retrieveSchemes` for embedding search over the same summaries.
 */
import { prisma } from "@/lib/db";
import { getGemini, GEMINI_MODEL, hasGeminiKey } from "./client";
import { matchSchemes, type SchemeLike, type Profile } from "@/lib/eligibility/matcher";
import type { RuleOperator, RuleValue } from "@/lib/eligibility/rules";

export interface RetrievedScheme {
  slug: string;
  title: string;
  summary: string;
  category: string | null;
  benefits: string | null;
  eligible?: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "is", "are",
  "am", "i", "my", "me", "can", "get", "what", "which", "how", "do", "does",
  "any", "there", "scheme", "schemes", "government", "help", "want", "need",
  "eligible", "apply", "have", "with", "from", "about",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Retrieve the schemes most relevant to a query. When a profile is supplied,
 * schemes the user is eligible for are boosted and flagged.
 */
export async function retrieveSchemes(
  query: string,
  profile?: Profile,
  limit = 8,
): Promise<RetrievedScheme[]> {
  const schemes = await prisma.scheme.findMany({
    include: { eligibilityRules: true },
  });

  const terms = tokenize(query);

  // Eligibility boost: which schemes does this profile qualify for?
  const eligibleSlugs = new Set<string>();
  if (profile && Object.keys(profile).length > 0) {
    const asLike: SchemeLike[] = schemes.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      rules: s.eligibilityRules.map((r) => ({
        attribute: r.attribute,
        operator: r.operator as RuleOperator,
        value: r.value as RuleValue,
        orGroup: r.orGroup,
      })),
    }));
    for (const m of matchSchemes(asLike, profile)) {
      if (m.status === "eligible") eligibleSlugs.add(m.slug);
    }
  }

  // Keep keyword relevance and eligibility as separate signals: keywords decide
  // topical relevance; eligibility only refines the order (a smaller bonus than
  // a single keyword hit) so it never drowns out what the user actually asked.
  const ELIG_BONUS = 0.75;
  const scored = schemes.map((s) => {
    const haystack = tokenize(
      `${s.title} ${s.summary} ${s.category ?? ""} ${s.ministry ?? ""} ${s.benefits ?? ""}`,
    );
    const hay = new Set(haystack);
    let keywordScore = terms.reduce((acc, t) => acc + (hay.has(t) ? 1 : 0), 0);
    // Partial matches (e.g. "pension" in "pensioner").
    keywordScore += terms.reduce(
      (acc, t) => acc + (haystack.some((h) => h.includes(t)) ? 0.5 : 0),
      0,
    );
    const eligible = eligibleSlugs.has(s.slug);
    return { s, keywordScore, total: keywordScore + (eligible ? ELIG_BONUS : 0) };
  });

  const hasKeywordSignal = scored.some((x) => x.keywordScore > 0);

  // When the query has topical keywords, rank by them (eligibility refines).
  // When it's generic ("what can I get?"), fall back to eligibility ordering.
  const ranked = scored
    .filter((x) =>
      hasKeywordSignal
        ? x.keywordScore > 0
        : eligibleSlugs.has(x.s.slug),
    )
    .sort((a, b) => b.total - a.total);

  // If nothing matched at all, return a general set so the assistant always has
  // something concrete to work with.
  const chosen = (ranked.length ? ranked.map((x) => x.s) : schemes).slice(
    0,
    limit,
  );

  return chosen.map((s) => ({
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    category: s.category,
    benefits: s.benefits,
    eligible: eligibleSlugs.has(s.slug),
  }));
}

function buildContext(schemes: RetrievedScheme[]): string {
  return schemes
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title} (id: ${s.slug})\n` +
        `Category: ${s.category ?? "General"}\n` +
        `Summary: ${s.summary}\n` +
        (s.benefits ? `Benefits: ${s.benefits}\n` : "") +
        (s.eligible ? `Note: the user appears ELIGIBLE for this.\n` : ""),
    )
    .join("\n");
}

const SYSTEM = `You are the IndiaConnect assistant, helping ordinary Indian citizens understand government welfare schemes in plain, warm language.

Rules:
- Answer ONLY using the schemes provided in the context below. Never invent schemes, benefit amounts, or eligibility criteria.
- If the context has nothing relevant, say so honestly and suggest using the eligibility finder.
- Refer to schemes by their exact name. Keep answers short and practical (a few sentences), suitable for someone with limited literacy.
- When the user seems eligible for something (marked in context), lead with that.
- Do not give legal or financial guarantees; remind them to confirm on the official website when relevant.`;

export interface AssistantAnswer {
  answer: string;
  sources: RetrievedScheme[];
  grounded: boolean; // true when Gemini produced the answer
}

/**
 * Answer a question, grounded on retrieved schemes. Falls back to a
 * retrieval-only response when Gemini isn't configured or errors.
 */
export async function answerQuestion(
  message: string,
  history: ChatTurn[],
  profile?: Profile,
): Promise<AssistantAnswer> {
  const sources = await retrieveSchemes(message, profile);

  if (!hasGeminiKey()) {
    return { answer: fallbackAnswer(sources), sources, grounded: false };
  }

  try {
    const ai = getGemini();
    const contents = [
      ...history.map((t) => ({
        role: t.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: t.content }],
      })),
      {
        role: "user" as const,
        parts: [
          {
            text: `Context — schemes you may reference:\n\n${buildContext(sources)}\n\nUser question: ${message}`,
          },
        ],
      },
    ];

    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { systemInstruction: SYSTEM, temperature: 0.3 },
    });

    return {
      answer: res.text?.trim() || fallbackAnswer(sources),
      sources,
      grounded: true,
    };
  } catch {
    return { answer: fallbackAnswer(sources), sources, grounded: false };
  }
}

function fallbackAnswer(sources: RetrievedScheme[]): string {
  if (!sources.length) {
    return "I couldn't find a matching scheme just now. Try the eligibility finder to see what you may qualify for.";
  }
  const eligible = sources.filter((s) => s.eligible);
  const lead = eligible.length
    ? `Based on your profile, you may be eligible for ${eligible.length} scheme${eligible.length === 1 ? "" : "s"}. `
    : "";
  return `${lead}Here are some schemes that look relevant — tap any to see details, documents, and how to apply.`;
}
