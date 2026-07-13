/**
 * Gemini-backed translation.
 *
 * Translates a whole batch in a single request (one call per scheme+language
 * rather than one per field) — that matters on a free-tier quota. Output is
 * schema-constrained to a string array so the mapping back to inputs is exact.
 */
import { Type } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import type { Locale } from "@/lib/i18n/config";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
};

const responseSchema = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
};

/**
 * Translate several strings at once, preserving order and count.
 * Throws on transport/quota errors so the caller can fall back.
 */
export async function geminiTranslateBatch(
  texts: string[],
  target: Locale,
  source: Locale = "en",
): Promise<string[]> {
  if (!texts.length || target === source) return texts;

  const targetName = LANGUAGE_NAMES[target] ?? target;
  const sourceName = LANGUAGE_NAMES[source] ?? source;

  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: JSON.stringify(texts),
    config: {
      systemInstruction: `You translate Indian government welfare scheme content from ${sourceName} into ${targetName}.

Rules:
- You receive a JSON array of strings. Return a JSON array of the SAME length, in the SAME order, with each string translated.
- Write simple, everyday ${targetName} that a citizen with limited literacy can understand. Avoid bureaucratic or Sanskritised vocabulary.
- Keep scheme names, ministry names, and acronyms (PM-KISAN, BPL, SC/ST, DigiLocker) recognisable — transliterate rather than inventing new names.
- Preserve numbers, currency amounts (₹6,000), dates, and percentages exactly.
- If a string is empty, return an empty string in its place.
- Return ONLY the JSON array.`,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  });

  const parsed = JSON.parse(res.text ?? "[]") as unknown;
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(
      `Gemini translation returned ${Array.isArray(parsed) ? parsed.length : "non-array"} items for ${texts.length} inputs`,
    );
  }
  // Never let a bad element blank out real content.
  return parsed.map((v, i) => (typeof v === "string" && v.trim() ? v : texts[i]));
}
