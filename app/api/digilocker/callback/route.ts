import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { getDigiLockerProvider } from "@/lib/digilocker/provider";
import { prisma } from "@/lib/db";

/** OAuth callback: exchange the code, pull issued documents, persist the link. */
export async function GET(req: Request) {
  const user = await getAuthedUser();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!user) return NextResponse.redirect(new URL("/account", base));

  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/account?digilocker=error", base));
  }

  try {
    const provider = getDigiLockerProvider();
    const tokens = await provider.exchangeCode(code);
    const docs = await provider.fetchIssuedDocuments(tokens);

    await prisma.$transaction(async (tx) => {
      const link = await tx.digiLockerLink.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          expiresAt: tokens.expiresAt ?? null,
        },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          expiresAt: tokens.expiresAt ?? null,
        },
      });
      // Refresh the cached document set.
      await tx.userDocument.deleteMany({ where: { linkId: link.id } });
      if (docs.length) {
        await tx.userDocument.createMany({
          data: docs.map((d) => ({
            linkId: link.id,
            docType: d.docType,
            name: d.name,
            issuer: d.issuer ?? null,
            uri: d.uri ?? null,
            issuedAt: d.issuedAt ?? null,
          })),
        });
      }
    });

    return NextResponse.redirect(new URL("/account?digilocker=connected", base));
  } catch {
    return NextResponse.redirect(new URL("/account?digilocker=error", base));
  }
}
