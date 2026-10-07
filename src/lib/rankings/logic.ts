import { slugify } from "@/lib/catalog/normalize";
import type { CardLanguage } from "@/lib/cards/types";
import type { PricePoint } from "@/lib/prices/types";

// Rankings de colecciones ("las 10 cartas más caras de cada colección"): lógica pura con tests.
// El precio es aproximado (mercado de TCGplayer/Cardmarket vía TCGdex) y se recalcula cada semana.

export const TOP_N = 10;

// Idiomas con ranking. Para añadir el japonés: "JP" aquí (usa EUR de Cardmarket) y su sección en la página.
export const RANKING_LANGUAGES: CardLanguage[] = ["EN"];
export const RANKING_CURRENCY: Record<CardLanguage, { currency: string; source: string; label: string }> = {
  EN: { currency: "USD", source: "tcgplayer", label: "TCGplayer" },
  JP: { currency: "EUR", source: "cardmarket", label: "Cardmarket" },
};

// Cada cuánto se vuelve a barrer una colección
export const RESCAN_DAYS = 7;

// El precio de una carta para el ranking: el de su versión más cara, en la moneda del idioma.
export function bestPrice(points: PricePoint[], currency: string): { variant: string; price: number } | null {
  let best: { variant: string; price: number } | null = null;
  for (const p of points) {
    if (p.grader !== "RAW" || p.currency !== currency || !(p.price > 0)) continue;
    if (!best || p.price > best.price) best = { variant: p.variant, price: p.price };
  }
  return best;
}

// Las n más caras, de mayor a menor (a igual precio, por número de carta).
export function rankTop<T extends { price: number; localId: string }>(cards: T[], n = TOP_N): T[] {
  return [...cards]
    .sort((a, b) => b.price - a.price || a.localId.localeCompare(b.localId, "en", { numeric: true }))
    .slice(0, n);
}

// Dirección de cada colección: "/colecciones/paldean-fates-paf". Nombre + código (o id si no tiene);
// si aun así dos coinciden, la segunda lleva además el id.
export function setSlugs(sets: { key: string; id: string; name: string; code: string | null }[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const s of sets) {
    let slug = slugify(`${s.name} ${s.code ?? s.id}`) || slugify(s.id);
    if (used.has(slug)) slug = slugify(`${s.name} ${s.id}`);
    if (used.has(slug)) slug = `${slug}-${slugify(s.key)}`;
    used.add(slug);
    out.set(s.key, slug);
  }
  return out;
}
