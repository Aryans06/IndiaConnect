import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal and machine-only surfaces stay out of the index.
      disallow: ["/account", "/account/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
