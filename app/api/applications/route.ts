import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { setApplicationStatus } from "@/lib/account";

const schema = z.object({
  slug: z.string().min(1),
  status: z.enum(["SAVED", "IN_PROGRESS", "APPLIED", "REMOVE"]),
});

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const result = await setApplicationStatus(
      user.id,
      parsed.data.slug,
      parsed.data.status,
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
  }
}
