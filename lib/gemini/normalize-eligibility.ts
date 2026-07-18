/**
 * Converts a scheme's free-text eligibility criteria (markdown from myScheme)
 * into our structured EligibilityRule format using Gemini, then validates the
 * output against the same zod schema the curated seed uses. Anything Gemini
 * can't express in our vocabulary is dropped rather than guessed — a partial,
 * correct rule set beats a complete but wrong one.
 */
import { Type } from "@google/genai";
import { getGemini, GEMINI_MODEL, hasGeminiKey } from "./client";
import { groqComplete, hasGroqKey } from "@/lib/llm/groq";
import { ATTRIBUTES, ATTRIBUTE_KEYS } from "@/lib/eligibility/attributes";
import {
  RULE_OPERATORS,
  eligibilityRuleArraySchema,
  type EligibilityRuleInput,
} from "@/lib/eligibility/rules";

function buildAttributeGuide(): string {
  return ATTRIBUTE_KEYS.map((key) => {
    const a = ATTRIBUTES[key];
    const opts =
      a.type === "enum" && a.options
        ? ` (allowed values: ${a.options.map((o) => o.value).join(", ")})`
        : a.type === "boolean"
          ? " (true/false)"
          : a.type === "number"
            ? " (number)"
            : " (free text)";
    return `- ${key}: ${a.type}${opts}`;
  }).join("\n");
}

const SYSTEM = `You convert Indian government scheme eligibility criteria into structured machine-readable rules.

You may ONLY use these attributes:
${buildAttributeGuide()}

Operators: ${RULE_OPERATORS.join(", ")}.
- Use IN/NOT_IN with an array value; BETWEEN with a [min, max] array; all others with a scalar value.
- For income, convert phrasing like "₹2 lakh" to the integer 200000.
- If multiple criteria are alternatives (any one suffices), give them the SAME orGroup label; otherwise leave orGroup null (they are all required).
- Only emit a rule if it maps cleanly to an attribute above. DROP anything you cannot express (e.g. "must own land", "resident of a notified village"). Do NOT invent attributes or values.
- If nothing maps, return an empty array.

Be THOROUGH: extract EVERY criterion that maps to an attribute above. Missing an
age or income limit is a serious error — it would wrongly tell someone they qualify.

Examples of correct extraction:
- "age should be between 40 and 79 years" -> {"attribute":"age","operator":"BETWEEN","value":"[40, 79]"}
- "must be 60 years or above" -> {"attribute":"age","operator":"GTE","value":"60"}
- "annual family income should not exceed Rs. 2,00,000" -> {"attribute":"annualIncome","operator":"LTE","value":"200000"}
- "the applicant should be a widow" -> {"attribute":"gender","operator":"EQ","value":"female"}
- "belongs to a BPL family" -> {"attribute":"rationCardType","operator":"IN","value":"[\\"BPL\\", \\"AAY\\"]"}
- "must be a farmer" -> {"attribute":"occupation","operator":"EQ","value":"farmer"}
- "SC or ST candidates" -> {"attribute":"socialCategory","operator":"IN","value":"[\\"SC\\", \\"ST\\"]"}
- "persons with disability" -> {"attribute":"isDisabled","operator":"EQ","value":"true"}`;

const ruleSchema = {
  type: Type.OBJECT,
  properties: {
    attribute: { type: Type.STRING },
    operator: { type: Type.STRING },
    // value is polymorphic; we accept it as a JSON string and parse below.
    value: { type: Type.STRING },
    orGroup: { type: Type.STRING, nullable: true },
  },
  required: ["attribute", "operator", "value"],
};

const responseSchema = {
  type: Type.ARRAY,
  items: ruleSchema,
};

/** Batch shape: one entry per scheme, echoing the id back so we can map results. */
const batchResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      rules: { type: Type.ARRAY, items: ruleSchema },
    },
    required: ["id", "rules"],
  },
};

interface RawRule {
  attribute: string;
  operator: string;
  value: string;
  orGroup?: string | null;
}

function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  // Arrays / tuples come back as JSON-ish strings.
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

/**
 * @returns validated rules (possibly empty). Throws only on transport errors.
 */
export async function normalizeEligibility(
  eligibilityText: string,
): Promise<EligibilityRuleInput[]> {
  const text = eligibilityText?.trim();
  if (!text) return [];

  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Eligibility criteria:\n\n${text}`,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
    },
  });

  let parsed: RawRule[];
  try {
    parsed = JSON.parse(res.text ?? "[]");
  } catch {
    return [];
  }

  return validateRules(parsed, text);
}

/**
 * Coerce + validate raw model output against our rule schema, dropping anything
 * that doesn't pass. Shared by the single and batch paths so batched rules are
 * held to exactly the same standard.
 */
function validateRules(
  raw: RawRule[],
  sourceText: string,
): EligibilityRuleInput[] {
  const valid: EligibilityRuleInput[] = [];
  for (const r of raw ?? []) {
    const candidate = {
      attribute: r.attribute,
      operator: r.operator,
      value: coerceValue(r.value),
      orGroup: r.orGroup ?? null,
      rawText: sourceText.slice(0, 500),
    };
    const result = eligibilityRuleArraySchema.element.safeParse(candidate);
    if (result.success) valid.push(result.data);
  }
  return valid;
}

export interface BatchItem {
  id: string;
  eligibilityText: string;
}

const BATCH_INSTRUCTION = `Convert the eligibility criteria for EACH scheme below into rules.

Return one entry per scheme, echoing its "id" exactly, with its "rules" array
(use an empty array if nothing maps).`;

/**
 * Which model provider does the bulk rule extraction.
 *
 * Groq is preferred when available: this is a batch job over thousands of
 * schemes, so the binding constraint is requests-per-day, and Groq's free tier
 * is roughly 10x Gemini's while returning in ~2s instead of ~25s. Gemini stays
 * as the fallback. Whichever runs, the output goes through the same zod
 * validation, so a weaker model yields FEWER rules — never wrong ones.
 */
export function normalizerProvider(): "groq" | "gemini" | "none" {
  const forced = process.env.RULES_PROVIDER;
  if (forced === "groq" && hasGroqKey()) return "groq";
  if (forced === "gemini" && hasGeminiKey()) return "gemini";
  if (hasGroqKey()) return "groq";
  if (hasGeminiKey()) return "gemini";
  return "none";
}

/**
 * Normalize MANY schemes in a single request.
 *
 * Free tiers cap requests-per-day, not tokens — so batching ~10 schemes per
 * call cuts the request count by an order of magnitude and is the difference
 * between a backfill taking days and taking minutes.
 *
 * Returns a map of scheme id -> validated rules. Any scheme the model omits
 * simply maps to an empty array; callers still mark it processed.
 */
export async function normalizeEligibilityBatch(
  items: BatchItem[],
): Promise<Map<string, EligibilityRuleInput[]>> {
  const out = new Map<string, EligibilityRuleInput[]>();
  const usable = items.filter((i) => i.eligibilityText?.trim());
  for (const i of items) out.set(i.id, []);
  if (!usable.length) return out;

  // Groq's free tier is bounded by tokens-per-minute (12k), so keep each
  // scheme's criteria short. Eligibility criteria are front-loaded — the
  // machine-checkable bits (age, income, category) appear early, and the tail is
  // usually prose we can't express anyway.
  const perScheme = normalizerProvider() === "groq" ? 1200 : 4000;
  const payload = usable.map((i) => ({
    id: i.id,
    criteria: i.eligibilityText.trim().slice(0, perScheme),
  }));
  const textById = new Map(usable.map((i) => [i.id, i.eligibilityText]));

  if (normalizerProvider() === "groq") {
    return normalizeBatchWithGroq(payload, textById, out);
  }

  const ai = getGemini();

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${BATCH_INSTRUCTION}

Schemes:
${JSON.stringify(payload)}`,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: batchResponseSchema,
      temperature: 0,
    },
  });

  let parsed: { id: string; rules: RawRule[] }[];
  try {
    parsed = JSON.parse(res.text ?? "[]");
  } catch {
    return out; // all empty; caller still marks them processed
  }

  return collectBatch(parsed, textById, out);
}

/** Groq path: same prompt and validation, OpenAI-compatible JSON-object mode. */
async function normalizeBatchWithGroq(
  payload: { id: string; criteria: string }[],
  textById: Map<string, string>,
  out: Map<string, EligibilityRuleInput[]>,
): Promise<Map<string, EligibilityRuleInput[]>> {
  // Groq's JSON mode guarantees a valid JSON *object*, not an array, so we ask
  // for the array under a "results" key.
  const raw = await groqComplete({
    system: SYSTEM,
    user: `${BATCH_INSTRUCTION}

Respond with a JSON object of the form:
{"results":[{"id":"<scheme id>","rules":[{"attribute":"...","operator":"...","value":"...","orGroup":null}]}]}

Note: "value" must be a STRING — use "40" for numbers, "[40, 80]" for ranges,
"[\\"BPL\\", \\"AAY\\"]" for lists, "true"/"false" for booleans.

Schemes:
${JSON.stringify(payload)}`,
    json: true,
  });

  let parsed: { id: string; rules: RawRule[] }[];
  try {
    const obj = JSON.parse(raw) as {
      results?: { id: string; rules: RawRule[] }[];
    };
    parsed = obj.results ?? [];
  } catch {
    return out;
  }

  return collectBatch(parsed, textById, out);
}

/** Map validated rules back onto scheme ids, ignoring anything hallucinated. */
function collectBatch(
  parsed: { id: string; rules: RawRule[] }[],
  textById: Map<string, string>,
  out: Map<string, EligibilityRuleInput[]>,
): Map<string, EligibilityRuleInput[]> {
  for (const entry of parsed ?? []) {
    if (!entry?.id || !out.has(entry.id)) continue; // ignore hallucinated ids
    out.set(entry.id, validateRules(entry.rules, textById.get(entry.id) ?? ""));
  }
  return out;
}
