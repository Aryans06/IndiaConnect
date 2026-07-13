/**
 * Translation provider selection.
 *
 * Order of preference:
 *   1. Bhashini  — India's official government language stack. Used when
 *      credentials exist (set TRANSLATE_PROVIDER=bhashini to force it).
 *   2. Gemini    — the practical default. One less gated account to obtain, and
 *      it reuses the key already needed for rules and the assistant.
 *   3. Identity  — return the source text unchanged. The app stays fully usable
 *      in English rather than breaking.
 *
 * Callers should never need to know which one ran.
 */
import type { Locale } from "@/lib/i18n/config";
import { hasBhashini, translateBatch as bhashiniBatch } from "@/lib/bhashini/client";
import { hasGeminiKey } from "@/lib/gemini/client";
import { geminiTranslateBatch } from "./gemini";

export type TranslateProvider = "bhashini" | "gemini" | "none";

export function getTranslateProvider(): TranslateProvider {
  const forced = process.env.TRANSLATE_PROVIDER;
  if (forced === "bhashini" && hasBhashini()) return "bhashini";
  if (forced === "gemini" && hasGeminiKey()) return "gemini";
  if (forced === "none") return "none";

  if (hasBhashini()) return "bhashini";
  if (hasGeminiKey()) return "gemini";
  return "none";
}

export function canTranslate(): boolean {
  return getTranslateProvider() !== "none";
}

/**
 * Translate a batch of strings. Never throws — on any provider failure it
 * returns the original text, so a translation outage degrades to English
 * instead of an error page.
 */
export async function translateBatch(
  texts: string[],
  target: Locale,
  source: Locale = "en",
): Promise<string[]> {
  if (!texts.length || target === source) return texts;

  const provider = getTranslateProvider();
  try {
    if (provider === "bhashini") {
      return await bhashiniBatch(texts, target, source);
    }
    if (provider === "gemini") {
      return await geminiTranslateBatch(texts, target, source);
    }
  } catch (err) {
    console.warn(
      `[translate] ${provider} failed, falling back to source text:`,
      String(err).slice(0, 140),
    );
  }
  return texts;
}
