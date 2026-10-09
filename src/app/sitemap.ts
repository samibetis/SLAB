import type { MetadataRoute } from "next";
import { LANGS, localePath } from "@/lib/i18n";
import { rankingIndex } from "@/lib/rankings/data";
import { SITE_URL } from "@/lib/site";

// Sitemap para Google: portada, índice de colecciones y la página de cada colección con ranking, en
// español y en inglés. Cada entrada lleva su gemela en el otro idioma (hreflang).
// (Las fichas /carta/[slug] se añadirán con el Hito 4.)
export const revalidate = 86400;

type Entry = MetadataRoute.Sitemap[number];

// Una entrada por idioma para la misma página
const both = (path: string, rest: Omit<Entry, "url" | "alternates">): Entry[] => {
  const languages = Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}${localePath(l, path)}`]));
  return LANGS.map((l) => ({ url: `${SITE_URL}${localePath(l, path)}`, alternates: { languages }, ...rest }));
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sets = await rankingIndex().catch(() => []);
  return [
    ...both("/", { changeFrequency: "daily", priority: 1 }),
    ...both("/colecciones", { changeFrequency: "weekly", priority: 0.9 }),
    ...sets
      .filter((s) => s.scannedAt)
      .flatMap((s) => both(`/colecciones/${s.slug}`, { lastModified: s.scannedAt!, changeFrequency: "weekly", priority: 0.7 })),
  ];
}
