import type { Card, VariantOption } from "@/lib/cards/types";
import { getJson } from "@/lib/catalog/http";
import type { PricePoint } from "./types";

// Proveedor de pago de precios por nota, PREPARADO PERO APAGADO: se activa al poner SCRYDEX_API_KEY y
// SCRYDEX_TEAM_ID (y NEXT_PUBLIC_PAID_PRICES=1 para que la interfaz deje de pedir los precios a mano).
// Escrito a partir de la documentación pública (https://scrydex.com/docs/pokemon/price-history) y SIN
// PROBAR contra la API real: al tener clave, revisar los nombres de campos marcados con "(doc)".
//
// GET https://api.scrydex.com/pokemon/v1/cards/<id>/price_history?days=N
//   cabeceras X-Api-Key y X-Team-ID; 1 crédito por petición.
//   (doc) respuesta: { data: [{ date, prices: [{ variant, condition, type, company?, grade?, low, market, currency }] }], page, page_size, total_count }

const API = "https://api.scrydex.com/pokemon/v1";
export const SCRYDEX_SOURCE = "scrydex";

export const scrydexEnabled = () => !!(process.env.SCRYDEX_API_KEY && process.env.SCRYDEX_TEAM_ID);

interface ScrydexPrice {
  variant?: string;
  condition?: string;
  type?: string; // (doc) "raw" | "graded"
  company?: string; // (doc) "PSA", "BGS"...
  grade?: string | number;
  market?: number | null;
  low?: number | null;
  currency?: string;
}
export interface ScrydexHistory {
  data?: { date?: string; prices?: ScrydexPrice[] }[];
  page?: number;
  page_size?: number;
  total_count?: number;
}

// Nombre de versión en Scrydex (estilo TCGplayer, camelCase) para cada VariantOption nuestra.
export function scrydexVariant(o: Pick<VariantOption, "type" | "subtype" | "stamps">): string | null {
  const first = o.stamps?.includes("1st-edition");
  const otherStamps = (o.stamps ?? []).filter((s) => s !== "1st-edition");
  if (otherStamps.length) return null; // sellos promocionales: sin equivalencia conocida
  if (o.type === "reverse") return "reverseHolofoil";
  const finish = o.type === "normal" ? "Normal" : "Holofoil";
  if (first) return `firstEdition${finish}`;
  if (o.subtype === "shadowless") return `unlimitedShadowless${finish}`;
  if (o.subtype === "unlimited") return `unlimited${finish}`;
  if (o.subtype) return null;
  return o.type === "normal" ? "normal" : "holofoil";
}

const COMPANIES = new Set(["PSA", "BGS", "CGC", "SGC", "TAG"]);

// Respuesta de price_history -> puntos por nota de nuestra variante (el raw lo seguimos sacando de TCGdex).
export function scrydexPoints(cardId: string, variant: string, scrydexName: string, h: ScrydexHistory): PricePoint[] {
  const out: PricePoint[] = [];
  for (const day of h.data ?? []) {
    if (!day.date || !/^\d{4}-\d{2}-\d{2}/.test(day.date)) continue;
    for (const p of day.prices ?? []) {
      if (p.variant !== scrydexName || p.type !== "graded") continue;
      const company = p.company?.toUpperCase();
      const grade = Number(p.grade);
      const price = p.market ?? p.low;
      if (!company || !COMPANIES.has(company) || !Number.isFinite(grade) || !(price && price > 0)) continue;
      out.push({ cardId, variant, grader: company, grade, date: day.date.slice(0, 10), price: Math.round(price * 100) / 100, currency: p.currency ?? "USD", source: SCRYDEX_SOURCE });
    }
  }
  return out;
}

// Id de la carta en Scrydex: usa el de pokemontcg.io si lo tenemos (mismo formato, "base1-4"); si no,
// lo busca por nombre y número. (doc) la sintaxis de búsqueda es tipo Lucene.
async function scrydexId(card: Pick<Card, "name" | "localId" | "set" | "externalIds">, headers: HeadersInit): Promise<string | null> {
  if (card.externalIds.pokemontcg) return card.externalIds.pokemontcg;
  const number = card.localId.replace(/^0+(?=\d)/, "");
  const q = `name:"${card.name.replace(/"/g, "")}" number:${number}`;
  const r = await getJson<{ data?: { id: string; expansion?: { name?: string } }[] }>(
    `${API}/cards?q=${encodeURIComponent(q)}&pageSize=10&select=id,expansion`,
    { headers, revalidate: 86400 },
  );
  const hits = r.data ?? [];
  return (hits.find((c) => c.expansion?.name === card.set) ?? (hits.length === 1 ? hits[0] : null))?.id ?? null;
}

// Histórico por nota de una carta y versión. `days`: cuánto hacia atrás (la primera vez, un año).
export async function scrydexHistory(
  card: Pick<Card, "id" | "name" | "localId" | "set" | "externalIds">,
  option: VariantOption,
  days: number,
): Promise<PricePoint[]> {
  if (!scrydexEnabled()) return [];
  const name = scrydexVariant(option);
  if (!name) return [];
  const headers = { "X-Api-Key": process.env.SCRYDEX_API_KEY!, "X-Team-ID": process.env.SCRYDEX_TEAM_ID! };
  const id = await scrydexId(card, headers);
  if (!id) return [];
  const out: PricePoint[] = [];
  for (let page = 1; page <= 5; page++) {
    const h = await getJson<ScrydexHistory>(
      `${API}/cards/${encodeURIComponent(id)}/price_history?days=${days}&variant=${name}&page=${page}&page_size=100`,
      { headers, revalidate: 0, timeoutMs: 10000 },
    );
    out.push(...scrydexPoints(card.id, option.key, name, h));
    const seen = (h.page ?? page) * (h.page_size ?? 100);
    if (!h.total_count || seen >= h.total_count) break;
  }
  return out;
}
