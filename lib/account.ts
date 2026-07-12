/**
 * Account-side reads/writes: citizen profile, bookmarks, and application
 * tracking. All keyed to the app User id.
 */
import { prisma } from "@/lib/db";
import type {
  CitizenProfile,
  SocialCategory,
} from "@/lib/generated/prisma/client";

const SOCIAL_CATEGORIES: SocialCategory[] = ["GENERAL", "OBC", "SC", "ST"];

/** The finder/profile form shape — same attribute keys as the matcher. */
export interface ProfileInput {
  age?: number | null;
  gender?: string | null;
  state?: string | null;
  annualIncome?: number | null;
  occupation?: string | null;
  socialCategory?: string | null;
  isDisabled?: boolean | null;
  rationCardType?: string | null;
}

export async function upsertProfile(
  userId: string,
  input: ProfileInput,
): Promise<CitizenProfile> {
  const socialCategory =
    input.socialCategory &&
    SOCIAL_CATEGORIES.includes(input.socialCategory as SocialCategory)
      ? (input.socialCategory as SocialCategory)
      : null;

  const data = {
    age: input.age ?? null,
    gender: input.gender ?? null,
    state: input.state ?? null,
    annualIncome: input.annualIncome ?? null,
    occupation: input.occupation ?? null,
    socialCategory,
    isDisabled: input.isDisabled ?? null,
    rationCardType: input.rationCardType ?? null,
  };

  return prisma.citizenProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/** Profile as a flat record the matcher can consume. */
export function profileToMatcherInput(
  p: CitizenProfile | null,
): Record<string, string | number | boolean> {
  if (!p) return {};
  const out: Record<string, string | number | boolean> = {};
  if (p.age != null) out.age = p.age;
  if (p.gender) out.gender = p.gender;
  if (p.state) out.state = p.state;
  if (p.annualIncome != null) out.annualIncome = p.annualIncome;
  if (p.occupation) out.occupation = p.occupation;
  if (p.socialCategory) out.socialCategory = p.socialCategory;
  if (p.isDisabled != null) out.isDisabled = p.isDisabled;
  if (p.rationCardType) out.rationCardType = p.rationCardType;
  return out;
}

export async function getProfile(userId: string) {
  return prisma.citizenProfile.findUnique({ where: { userId } });
}

export async function toggleBookmark(
  userId: string,
  slug: string,
): Promise<{ bookmarked: boolean }> {
  const scheme = await prisma.scheme.findUnique({ where: { slug } });
  if (!scheme) throw new Error("SCHEME_NOT_FOUND");
  const existing = await prisma.bookmark.findUnique({
    where: { userId_schemeId: { userId, schemeId: scheme.id } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }
  await prisma.bookmark.create({ data: { userId, schemeId: scheme.id } });
  return { bookmarked: true };
}

export type AppStatus = "SAVED" | "IN_PROGRESS" | "APPLIED";

export async function setApplicationStatus(
  userId: string,
  slug: string,
  status: AppStatus | "REMOVE",
) {
  const scheme = await prisma.scheme.findUnique({ where: { slug } });
  if (!scheme) throw new Error("SCHEME_NOT_FOUND");
  if (status === "REMOVE") {
    await prisma.application
      .delete({ where: { userId_schemeId: { userId, schemeId: scheme.id } } })
      .catch(() => {});
    return { status: null };
  }
  await prisma.application.upsert({
    where: { userId_schemeId: { userId, schemeId: scheme.id } },
    create: { userId, schemeId: scheme.id, status },
    update: { status },
  });
  return { status };
}

/**
 * Ticks an application step on or off. Creates the Application (as IN_PROGRESS)
 * on first tick — starting the checklist *is* starting the application.
 */
export async function setStepCompletion(
  userId: string,
  slug: string,
  order: number,
  done: boolean,
): Promise<{ completedSteps: number[] }> {
  const scheme = await prisma.scheme.findUnique({ where: { slug } });
  if (!scheme) throw new Error("SCHEME_NOT_FOUND");

  const existing = await prisma.application.findUnique({
    where: { userId_schemeId: { userId, schemeId: scheme.id } },
  });

  const current = new Set(existing?.completedSteps ?? []);
  if (done) current.add(order);
  else current.delete(order);
  const completedSteps = [...current].sort((a, b) => a - b);

  const saved = await prisma.application.upsert({
    where: { userId_schemeId: { userId, schemeId: scheme.id } },
    create: {
      userId,
      schemeId: scheme.id,
      status: "IN_PROGRESS",
      completedSteps,
    },
    update: { completedSteps },
  });

  return { completedSteps: saved.completedSteps };
}

export async function getBookmarks(userId: string) {
  return prisma.bookmark.findMany({
    where: { userId },
    include: { scheme: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplications(userId: string) {
  return prisma.application.findMany({
    where: { userId },
    include: { scheme: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** What a scheme detail page needs about the current user's relationship to it. */
export async function getUserSchemeState(userId: string, slug: string) {
  const scheme = await prisma.scheme.findUnique({ where: { slug } });
  if (!scheme) {
    return { bookmarked: false, applicationStatus: null, completedSteps: [] };
  }
  const [bookmark, application] = await Promise.all([
    prisma.bookmark.findUnique({
      where: { userId_schemeId: { userId, schemeId: scheme.id } },
    }),
    prisma.application.findUnique({
      where: { userId_schemeId: { userId, schemeId: scheme.id } },
    }),
  ]);
  return {
    bookmarked: Boolean(bookmark),
    applicationStatus: application?.status ?? null,
    completedSteps: application?.completedSteps ?? [],
  };
}
