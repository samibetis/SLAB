import { getSets } from "@/lib/catalog/sets";
import type { SetInfo } from "@/lib/catalog/types";
import { getRanking, listRankings } from "@/lib/db/rankings-repo";
import type { SetRankingRow } from "@/lib/db/schema";
import { RANKING_LANGUAGES, setSlugs } from "./logic";

// Servidor: lo que leen las páginas /colecciones (índice y ficha de cada colección).

export interface RankingSummary {
  key: string;
  slug: string;
  name: string;
  code: string | null;
  year: string | null;
  releaseDate: string | null;
  topName: string | null;
  topPrice: number | null;
  topImage: string | null;
  currency: string | null;
  scannedAt: string | null;
}

async function rankedSets(): Promise<{ sets: SetInfo[]; slugs: Map<string, string> }> {
  const sets = (await getSets()).filter((s) => RANKING_LANGUAGES.includes(s.language));
  return { sets, slugs: setSlugs(sets) };
}

// Todas las colecciones con ranking (o pendientes), de la más nueva a la más antigua.
export async function rankingIndex(): Promise<RankingSummary[]> {
  const { sets, slugs } = await rankedSets();
  const rows = new Map<string, SetRankingRow>();
  for (const lang of RANKING_LANGUAGES) for (const r of await listRankings(lang).catch(() => [])) rows.set(r.setKey, r);
  return sets
    .map((s) => {
      const r = rows.get(s.key);
      const top = r?.top[0];
      return {
        key: s.key, slug: slugs.get(s.key)!, name: s.name, code: s.code,
        year: s.releaseDate?.slice(0, 4) ?? null, releaseDate: s.releaseDate ?? null,
        topName: top?.name ?? null, topPrice: top?.price ?? null, topImage: top?.image ?? null,
        currency: r?.currency ?? null, scannedAt: r?.scannedAt.toISOString() ?? null,
      };
    })
    .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.name.localeCompare(b.name));
}

export async function rankingBySlug(slug: string): Promise<{ set: SetInfo; slug: string; ranking: SetRankingRow | null } | null> {
  const { sets, slugs } = await rankedSets();
  const set = sets.find((s) => slugs.get(s.key) === slug);
  if (!set) return null;
  return { set, slug, ranking: await getRanking(set.key).catch(() => null) };
}

// Imagen grande a partir de la miniatura guardada (TCGdex low -> high; pokemontcg/scrydex small -> large).
export const bigImage = (url: string | null) =>
  url ? url.replace(/\/low\.webp$/, "/high.webp").replace(/\/small$/, "/large") : null;
