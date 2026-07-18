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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Groq reports resets like "4.795s" or "7m12s". */
function parseReset(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/(?:(\d+)m)?([\d.]+)s/);
  if (!m) return null;
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000;
}

/**
 * Single chat completion, retrying through per-minute rate limits.
 *
 * Groq's free tier is bounded by tokens-per-minute (12k) far more than by
 * requests (1k/min), and the token budget refills in seconds. So a 429 here
 * almost always means "wait a moment", not "you're done for the day" — we read
 * the reset header and wait it out rather than abandoning the run.
 */
export async function groqComplete(opts: GroqOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const MAX_RETRIES = 6;
  for (let attempt = 0; ; attempt++) {
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

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait =
        parseReset(res.headers.get("x-ratelimit-reset-tokens")) ??
        parseReset(res.headers.get("x-ratelimit-reset-requests")) ??
        (Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 5000);
      // Small cushion so we don't wake up exactly on the boundary.
      await sleep(Math.min(70_000, wait + 1000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
