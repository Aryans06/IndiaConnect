/**
 * Groq — used for bulk eligibility-rule extraction.
 *
 * Rule extraction is a batch job over thousands of schemes, so the binding
 * constraint is requests-per-day, not answer quality at the margin. Groq's free
 * tier is roughly an order of magnitude more generous than Gemini's and returns
 * in ~2s instead of ~25s, which turns a two-week backfill into a single run.
 *
 * Groq exposes an OpenAI-compatible endpoint, so this is a plain fetch — no
 * extra SDK dependency.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export interface GroqOptions {
  system: string;
  user: string;
  /** Ask for a JSON object back. Groq enforces valid JSON, not a schema. */
  json?: boolean;
  temperature?: number;
}

/** Single chat completion. Throws on transport/quota errors so callers can retry. */
export async function groqComplete(opts: GroqOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: opts.temperature ?? 0,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}
