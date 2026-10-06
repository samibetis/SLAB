import { DETAIL_VERSION, type Card, type CardLanguage } from "@/lib/cards/types";
import { getJson } from "./http";
import { buildCardId, buildSlug, formatNumber, mapType, year } from "./normalize";
import type { CardRef, CatalogProvider, ParsedQuery, SearchOptions } from "./types";

// Respaldo solo para inglés. Clave opcional en POKEMONTCG_API_KEY (1.000 peticiones/día sin ella, 20.000 con ella).
// Sus imágenes no llevan CORS: el visor 3D las carga a través de /api/img.
const API = "https://api.pokemontcg.io/v2/cards";

interface ApiCard {
  id: string; name: string; number: string; rarity?: string; types?: string[];
  set: { id: string; name: string; printedTotal?: number; releaseDate?: string };
  images?: { small?: string; large?: string };
}

const esc = (s: string) => s.replace(/["\\]/g, "");

export class PokemonTcgProvider implements CatalogProvider {
  readonly id = "pokemontcg";
  readonly languages: CardLanguage[] = ["EN"];

  async search(q: ParsedQuery, opts: SearchOptions): Promise<CardRef[]> {
    if (!opts.languages.includes("EN")) return [];
    const s = q.splits[0];
    const parts = [`name:"${esc(s.name)}*"`];
    if (s.set) parts.push(`set.name:"${esc(s.set)}*"`);
    if (q.number) parts.push(`number:${q.number}`);
    const url = `${API}?q=${encodeURIComponent(parts.join(" "))}&pageSize=20&select=id,name,number,rarity,types,set,images`;
    const key = process.env.POKEMONTCG_API_KEY;
    const json = await getJson<{ data: ApiCard[] }>(url, {
      signal: opts.signal,
      timeoutMs: 10000,
      headers: key ? { "X-Api-Key": key } : undefined,
    });
    return json.data.map((c) => {
      const card = this.toCard(c);
      return {
        provider: this.id, externalId: c.id, language: "EN", name: c.name, localId: c.number,
        hasImage: !!card.imageUrl, card,
      };
    });
  }

  async getCard(ref: CardRef): Promise<Card | null> {
    return ref.card ?? null; // el listado ya trae todo
  }

  private toCard(c: ApiCard): Card {
    const id = buildCardId("EN", c.set.id, c.number);
    return {
      id,
      slug: buildSlug(c.name, id),
      name: c.name,
      set: c.set.name,
      setId: c.set.id,
      localId: c.number,
      number: formatNumber(c.number, c.set.printedTotal),
      year: year(c.set.releaseDate?.replace(/\//g, "-")),
      releaseDate: c.set.releaseDate?.replace(/\//g, "-"),
      language: "EN",
      rarity: c.rarity,
      type: mapType(c.types?.[0]),
      imageUrl: c.images?.large ?? null,
      imageThumbUrl: c.images?.small ?? null,
      imageNeedsProxy: true,
      externalIds: { [this.id]: c.id },
      variants: null,
      variantOptions: [], // esta API no detalla las versiones
      detailVersion: DETAIL_VERSION,
    };
  }
}
