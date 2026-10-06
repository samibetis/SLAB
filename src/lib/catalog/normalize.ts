import type { Card, CardLanguage, VariantOption } from "@/lib/cards/types";
import type { CardRef, ParsedQuery } from "./types";

// Funciones puras de normalización y ranking. Sin red ni base de datos: se testean solas.

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Id propio: "en-base1-4". Coincide entre proveedores cuando comparten id de colección y número.
export const buildCardId = (lang: CardLanguage, setId: string, localId: string) =>
  `${lang.toLowerCase()}-${setId}-${localId}`.toLowerCase();

// Slug para /carta/[slug]. Lleva el id de colección y el número, así que es único por construcción.
export function buildSlug(name: string, id: string) {
  const base = slugify(name);
  return base ? `${base}-${id}` : id; // nombres solo japoneses: el id basta
}

// TCGdex da el número oficial de cartas de la colección: "4" + 102 -> "4/102".
export const formatNumber = (localId: string, official?: number | null) =>
  official && /^\d+$/.test(localId) ? `${localId}/${String(official).padStart(localId.length, "0")}` : localId;

const TYPE_MAP: Record<string, string> = {
  fire: "fire", water: "water", grass: "grass", lightning: "lightning", electric: "lightning",
  psychic: "psychic", fighting: "fighting", darkness: "darkness", dark: "darkness",
  metal: "metal", steel: "metal", dragon: "dragon", fairy: "fairy", colorless: "colorless",
};
export const mapType = (t?: string | null) => (t && TYPE_MAP[t.toLowerCase()]) || "colorless";

export const year = (date?: string | null) => {
  const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : undefined;
};

// ---- Variantes ----

interface RawVariant { type?: string; subtype?: string; stamp?: string[]; thirdParty?: { tcgplayer?: number } }

// TCGdex lista cada versión de la carta (variants_detailed). Se quedan las distintas, en el orden recibido.
export function variantOptions(detailed: RawVariant[] | undefined | null, flags?: Record<string, boolean> | null): VariantOption[] {
  const out: VariantOption[] = [];
  const seen = new Set<string>();
  const add = (type: string, subtype?: string, stamps?: string[], tcgplayerId?: number) => {
    const key = [type, subtype, ...(stamps ?? [])].filter(Boolean).join("-").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      key, type,
      ...(subtype ? { subtype } : {}),
      ...(stamps?.length ? { stamps } : {}),
      ...(tcgplayerId ? { tcgplayerId } : {}),
    });
  };
  if (detailed?.length) detailed.forEach((v) => v.type && add(v.type, v.subtype, v.stamp, v.thirdParty?.tcgplayer));
  else if (flags) for (const t of ["normal", "holo", "reverse"]) if (flags[t]) add(t);
  return out;
}

// ---- Interpretación de la búsqueda ----

const NUMBER_RE = /^#?(\d{1,4})(?:\/\d{1,4})?$/;
// Describen la versión, no el nombre ni la colección: se ignoran al buscar ("Lugia 1st edition").
const NOISE = new Set(["1st", "first", "edition", "edicion", "edición", "unlimited", "shadowless", "alt", "art", "holo", "reverse", "psa", "raw", "graded"]);

export function parseQuery(raw: string, opts: { numberAsWord?: boolean } = {}): ParsedQuery {
  const clean = raw.replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  const kept = words.filter((w) => !NOISE.has(w.toLowerCase()));
  const all = kept.length ? kept : words;
  let number: string | null = null;
  const tokens: string[] = [];
  for (const t of all) {
    const m = t.match(NUMBER_RE);
    if (m && !opts.numberAsWord && number === null && all.length > 1) number = m[1];
    else tokens.push(t);
  }
  if (!tokens.length && number) tokens.push(...all); // solo un número: se busca como nombre
  // Primero el nombre más largo (todas las palabras), luego repartos nombre + colección.
  const splits: ParsedQuery["splits"] = [];
  for (let k = tokens.length; k >= 1 && splits.length < 4; k--) {
    splits.push({ name: tokens.slice(0, k).join(" "), set: k < tokens.length ? tokens.slice(k).join(" ") : null });
  }
  return { raw: clean, tokens, number, splits };
}

// ---- Número de carta ----

// Elige las cartas que corresponden al número escrito. El cero inicial importa: "054" es el número
// impreso de una carta concreta ("054/091"). Si se escribe con cero se busca primero ese número exacto;
// si no existe (colecciones antiguas sin ceros: "54"), o si se escribe sin cero ("54"), se compara el valor.
// Los números no numéricos ("TG05", "SWSH054") nunca coinciden con una búsqueda numérica.
export function pickByNumber<T extends { localId: string }>(items: T[], typed: string): T[] {
  const value = parseInt(typed, 10);
  const byValue = items.filter((i) => /^\d+$/.test(i.localId) && parseInt(i.localId, 10) === value);
  if (/^0\d/.test(typed)) {
    const exact = items.filter((i) => i.localId === typed);
    if (exact.length) return exact;
  }
  return byValue;
}

// ---- Ranking ----

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Antes del detalle: coincidencia de nombre y presencia de imagen.
export function rankRefs(refs: CardRef[], q: ParsedQuery): CardRef[] {
  const nameQ = norm(q.splits[0]?.name ?? q.raw);
  const tier = (r: CardRef) => {
    const n = norm(r.name);
    return n === nameQ ? 0 : n.startsWith(nameQ) ? 1 : n.includes(nameQ) ? 2 : 3;
  };
  return refs
    .map((r, i) => ({ r, i }))
    .sort((a, b) => tier(a.r) - tier(b.r) || Number(b.r.hasImage) - Number(a.r.hasImage) || a.i - b.i)
    .map((x) => x.r);
}

const RARITY_SCORE: [RegExp, number][] = [
  [/secret|hyper|rainbow|illustration rare|special illustration|gold|ultra|vmax|vstar|amazing|full art/i, 3],
  [/holo|double rare|rare/i, 2],
  [/uncommon|common/i, 0],
];
const rarityScore = (r?: string) => RARITY_SCORE.find(([re]) => r && re.test(r))?.[1] ?? 1;

// Después del detalle: lo que suele interesar a coleccionistas primero (rareza alta, más antigua).
export function rankCards(cards: Card[], q: ParsedQuery): Card[] {
  const nameQ = norm(q.splits[0]?.name ?? q.raw);
  const tier = (c: Card) => {
    const n = norm(c.name);
    return n === nameQ ? 0 : n.startsWith(nameQ) ? 1 : n.includes(nameQ) ? 2 : 3;
  };
  return [...cards].sort(
    (a, b) =>
      tier(a) - tier(b) ||
      Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
      rarityScore(b.rarity) - rarityScore(a.rarity) ||
      (a.year ?? 9999) - (b.year ?? 9999),
  );
}
