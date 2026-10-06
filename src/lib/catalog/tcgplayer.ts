import type { Card, VariantOption } from "@/lib/cards/types";

// Foto real de versiones especiales (con sello, shadowless...) buscando su producto en TCGplayer.
// SOLO PARA DEMOSTRACIÓN: usa el buscador interno de su web, sin acuerdo de uso. Va detrás del
// interruptor VARIANT_PHOTOS (ver variantPhotosEnabled) y no debe activarse en producción sin permiso.

export interface TcgProduct {
  productId: number;
  productName: string; // "Pikachu - 025/165 (Pokemon Together)"
  setName: string;
  number: string | null; // "025/165"
}

// Palabras con que TCGplayer nombra cada sello o subtipo (en el nombre del producto, entre paréntesis).
const WORDS: Record<string, string[]> = {
  "pokemon-together": ["pokemon together"],
  snowflake: ["holiday calendar", "snowflake"],
  "pre-release": ["prerelease", "pre-release"],
  prerelease: ["prerelease", "pre-release"],
  staff: ["staff"],
  "1st-edition": ["1st edition", "first edition"],
  "missing-expansion-symbol": ["no set symbol", "missing set symbol", "missing expansion"],
  shadowless: ["shadowless"],
};

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Grupos de palabras que el nombre del producto debe contener: uno por sello (y por subtipo especial).
// Dentro de cada grupo basta con una de las alternativas.
export function variantKeywords(o: VariantOption): string[][] {
  const parts = [...(o.stamps ?? [])];
  if (o.subtype && !/^(unlimited|1999-2000-copyright)$/.test(o.subtype)) parts.push(o.subtype);
  return parts.map((p) => WORDS[p] ?? [norm(p.replace(/[-_]+/g, " "))]);
}

// ¿Es la misma carta? Mismo número impreso ("025/165"), o mismo número dentro del nombre del producto.
function sameCard(p: TcgProduct, card: Pick<Card, "number" | "localId">): boolean {
  const target = (card.number ?? card.localId).replace(/\s+/g, "");
  if (p.number && p.number.replace(/\s+/g, "") === target) return true;
  return p.productName.replace(/\s+/g, "").includes(target);
}

// De los productos encontrados, el de esa carta cuyo nombre lleva todos los sellos de la versión.
export function pickVariantProduct(
  products: TcgProduct[],
  card: Pick<Card, "number" | "localId">,
  o: VariantOption,
): TcgProduct | null {
  const groups = variantKeywords(o);
  if (!groups.length) return null;
  return (
    products.find((p) => sameCard(p, card) && groups.every((alts) => alts.some((a) => norm(p.productName).includes(a)))) ?? null
  );
}

export const tcgplayerImage = (productId: number) => `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_in_1000x1000.jpg`;

// Activo en desarrollo; en producción solo con VARIANT_PHOTOS=tcgplayer. VARIANT_PHOTOS=off lo apaga siempre.
export const variantPhotosEnabled = () =>
  process.env.VARIANT_PHOTOS !== "off" && (process.env.NODE_ENV !== "production" || process.env.VARIANT_PHOTOS === "tcgplayer");

interface SearchHit {
  productId: number;
  productName: string;
  setName: string;
  productLineName?: string;
  customAttributes?: { number?: string };
}

// Buscador de la web de TCGplayer (servidor). Devuelve productos de Pokémon en inglés.
export async function searchTcgplayer(q: string, signal?: AbortSignal): Promise<TcgProduct[]> {
  const res = await fetch(`https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(q)}&isList=false`, {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      algorithm: "sales_synonym_v2",
      from: 0,
      size: 24,
      filters: { term: { productLineName: ["pokemon"] }, range: {}, match: {} },
      listingSearch: { context: { cart: {} }, filters: { term: {}, range: {}, exclude: { channelExclusion: 0 } } },
      context: { cart: {}, shippingCountry: "US" },
      settings: { useFuzzySearch: true, didYouMean: {} },
      sort: {},
    }),
  });
  if (!res.ok) throw new Error(`TCGplayer respondió ${res.status}`);
  const j = (await res.json()) as { results?: { results?: SearchHit[] }[] };
  return (j.results?.[0]?.results ?? []).map((h) => ({
    productId: h.productId,
    productName: h.productName,
    setName: h.setName,
    number: h.customAttributes?.number ?? null,
  }));
}
