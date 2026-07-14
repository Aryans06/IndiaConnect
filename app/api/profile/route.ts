import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import { upsertProfile } from "@/lib/account";

const schema = z.object({
  age: z.number().int().min(0).max(120).nullable().optional(),
  gender: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  annualIncome: z.number().int().min(0).nullable().optional(),
  occupation: z.string().nullable().optional(),
  socialCategory: z.string().nullable().optional(),
  isDisabled: z.boolean().nullable().optional(),
  rationCardType: z.string().nullable().optional(),
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
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  const profile = await upsertProfile(user.id, parsed.data);
  return NextResponse.json({ ok: true, profile });
}
