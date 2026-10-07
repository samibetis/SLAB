import type { MetadataRoute } from "next";
import { rankingIndex } from "@/lib/rankings/data";
import { SITE_URL } from "@/lib/site";

// Sitemap para Google: portada, índice de colecciones y la página de cada colección con ranking.
// (Las fichas /carta/[slug] se añadirán con el Hito 4.)
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sets = await rankingIndex().catch(() => []);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/colecciones`, changeFrequency: "weekly", priority: 0.9 },
    ...sets
      .filter((s) => s.scannedAt)
      .map((s) => ({ url: `${SITE_URL}/colecciones/${s.slug}`, lastModified: s.scannedAt!, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
