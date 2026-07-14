import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { getProfile, profileToMatcherInput } from "@/lib/account";
import { answerQuestion, type ChatTurn } from "@/lib/gemini/assistant";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

const schema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
});

// Public, unauthenticated, and every hit costs a Gemini call — so it's capped.
const LIMIT = Number(process.env.ASSISTANT_RATE_LIMIT ?? 15);
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, "assistant"), LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait a moment and try again.",
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Ground on the signed-in user's profile when available.
  const user = await getAuthedUser();
  const profile = user ? await getProfile(user.id) : null;
  const matcherInput = profileToMatcherInput(profile);

  const result = await answerQuestion(
    parsed.data.message,
    (parsed.data.history ?? []) as ChatTurn[],
    matcherInput,
  );

  return NextResponse.json(result);
}
