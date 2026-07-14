import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import { setStepCompletion } from "@/lib/account";

const schema = z.object({
  slug: z.string().min(1),
  order: z.number().int().min(1),
  done: z.boolean(),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "write"), 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { slug, order, done } = parsed.data;
    const result = await setStepCompletion(user.id, slug, order, done);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
  }
}
