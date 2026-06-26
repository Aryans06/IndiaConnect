/**
 * Gemini client (Google AI Studio, free tier). Used offline during ingest to
 * normalize eligibility text, and at runtime for the grounded assistant
 * (Phase 5). Lazily constructed so the app boots without a key set.
 */
import { GoogleGenAI } from "@google/genai";

// Flash-class model: fast and generous on the free tier.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env (free key from Google AI Studio).",
    );
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
