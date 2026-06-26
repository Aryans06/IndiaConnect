/**
 * Converts a scheme's free-text eligibility criteria (markdown from myScheme)
 * into our structured EligibilityRule format using Gemini, then validates the
 * output against the same zod schema the curated seed uses. Anything Gemini
 * can't express in our vocabulary is dropped rather than guessed — a partial,
 * correct rule set beats a complete but wrong one.
 */
import { Type } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "./client";
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
- If nothing maps, return an empty array.`;

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      attribute: { type: Type.STRING },
      operator: { type: Type.STRING },
      // value is polymorphic; we accept it as a JSON string and parse below.
      value: { type: Type.STRING },
      orGroup: { type: Type.STRING, nullable: true },
    },
    required: ["attribute", "operator", "value"],
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

  const candidates = parsed.map((r) => ({
    attribute: r.attribute,
    operator: r.operator,
    value: coerceValue(r.value),
    orGroup: r.orGroup ?? null,
    rawText: text.slice(0, 500),
  }));

  // Validate; keep only the rules that pass our schema.
  const valid: EligibilityRuleInput[] = [];
  for (const c of candidates) {
    const result = eligibilityRuleArraySchema.element.safeParse(c);
    if (result.success) valid.push(result.data);
  }
  return valid;
}
