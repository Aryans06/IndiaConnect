import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

/**
 * Organic search is how an unaware citizen actually finds a scheme they've
 * never heard of — so every scheme page is listed here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const schemes = await prisma.scheme.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/schemes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/finder`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/assistant`, changeFrequency: "monthly", priority: 0.6 },
  ];

  return [
    ...staticRoutes,
    ...schemes.map((s) => ({
      url: `${base}/schemes/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
