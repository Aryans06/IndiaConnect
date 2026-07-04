import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { getProfile, profileToMatcherInput } from "@/lib/account";
import { answerQuestion, type ChatTurn } from "@/lib/gemini/assistant";

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

export async function POST(req: Request) {
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
