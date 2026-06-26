/**
 * Match a scheme's required documents against the documents a user has in
 * DigiLocker, producing a "have ✓ / still need" breakdown.
 */
import { prisma } from "@/lib/db";

export interface DocMatch {
  name: string;
  digilockerDocType: string | null;
  have: boolean;
  /** Document with no DigiLocker mapping → we can't auto-verify it. */
  checkable: boolean;
}

export interface DocMatchSummary {
  connected: boolean;
  matches: DocMatch[];
  haveCount: number;
  needCount: number;
}

/** Returns the set of doc types the user currently has in DigiLocker. */
export async function getUserDocTypes(userId: string): Promise<Set<string>> {
  const link = await prisma.digiLockerLink.findUnique({
    where: { userId },
    include: { documents: true },
  });
  return new Set(link?.documents.map((d) => d.docType) ?? []);
}

export function matchDocuments(
  required: { name: string; digilockerDocType: string | null }[],
  ownedTypes: Set<string>,
  connected: boolean,
): DocMatchSummary {
  const matches: DocMatch[] = required.map((d) => {
    const checkable = Boolean(d.digilockerDocType);
    const have = checkable && ownedTypes.has(d.digilockerDocType!);
    return {
      name: d.name,
      digilockerDocType: d.digilockerDocType,
      have,
      checkable,
    };
  });
  return {
    connected,
    matches,
    haveCount: matches.filter((m) => m.have).length,
    needCount: matches.filter((m) => m.checkable && !m.have).length,
  };
}
