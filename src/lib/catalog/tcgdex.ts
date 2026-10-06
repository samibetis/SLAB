import { DETAIL_VERSION, type Card, type CardLanguage } from "@/lib/cards/types";
import { imagesForSet } from "./fallback-images";
import { getJson } from "./http";
import { buildCardId, buildSlug, formatNumber, mapType, variantOptions, year } from "./normalize";
import type { CardRef, CatalogProvider, ParsedQuery, SearchOptions, SetInfo } from "./types";

// Principal: gratis, sin clave, multilingüe. Docs: https://tcgdex.dev
const API = "https://api.tcgdex.net/v2";
const LANG: Record<CardLanguage, string> = { EN: "en", JP: "ja" };
const PER_LIST = 20;

interface ListItem { id: string; localId: string; name: string; image?: string }
interface Detail {
  id: string; localId: string; name: string; image?: string; rarity?: string; types?: string[];
  set: { id: string; name: string; cardCount?: { official?: number } };
  variants?: Record<string, boolean>;
  variants_detailed?: { type?: string; subtype?: string; stamp?: string[]; thirdParty?: { tcgplayer?: number } }[];
}
interface SetDetail { releaseDate?: string }

// La fecha de salida sale del detalle de la colección; se recuerda en memoria porque es la misma para toda ella.
const setDates = new Map<string, Promise<string | undefined>>();
function setDate(lang: string, setId: string, signal?: AbortSignal) {
  const key = `${lang}/${setId}`;
  let p = setDates.get(key);
  if (!p) {
    p = getJson<SetDetail>(`${API}/${lang}/sets/${encodeURIComponent(setId)}`, { signal, revalidate: 86400 })
      .then((s) => s.releaseDate)
      .catch(() => { setDates.delete(key); return undefined; });
    setDates.set(key, p);
  }
  return p;
}

// Los filtros de TCGdex son por subcadena. Las claves llevan ":" y "." y se dejan sin codificar.
function listUrl(lang: string, name: string, set: string | null, number: string | null, setId?: string) {
  const p = [`name=${encodeURIComponent(name)}`];
  if (setId) p.push(`set.id=${encodeURIComponent(setId)}`); // colección exacta (código reconocido)
  else if (set) p.push(`set.name=${encodeURIComponent(set)}`);
  if (number) p.push(`localId=${encodeURIComponent(number)}`);
  p.push("pagination:page=1", `pagination:itemsPerPage=${PER_LIST}`);
  return `${API}/${lang}/cards?${p.join("&")}`;
}

export class TcgdexProvider implements CatalogProvider {
  readonly id = "tcgdex";
  readonly languages: CardLanguage[] = ["EN", "JP"];

  async search(q: ParsedQuery, opts: SearchOptions): Promise<CardRef[]> {
    const langs = opts.languages.filter((l) => this.languages.includes(l));
    // Con colecciones reconocidas (por su código) se busca solo en ellas, con el nombre completo.
    const targets = opts.sets?.length
      ? opts.sets.filter((s) => langs.includes(s.language)).flatMap((s) => [{ language: s.language, setId: s.id, split: q.splits[0] }])
      : langs.flatMap((language) => q.splits.map((split) => ({ language, setId: undefined as string | undefined, split })));
    const jobs = targets.map(async ({ language, setId, split: s }, priority) => {
        const items = await getJson<ListItem[]>(listUrl(LANG[language], s.name, s.set, q.number, setId), { signal: opts.signal });
        return items.map((it): CardRef & { priority: number } => ({
          provider: this.id, externalId: it.id, language, name: it.name, localId: String(it.localId),
          hasImage: !!it.image, priority,
        }));
    });
    // Si un idioma o un reparto falla, no tira todo el resultado.
    const settled = await Promise.allSettled(jobs);
    const ok = settled.filter((s): s is PromiseFulfilledResult<(CardRef & { priority: number })[]> => s.status === "fulfilled");
    if (!ok.length && settled.length) throw (settled[0] as PromiseRejectedResult).reason;
    // Los repartos más específicos primero; sin repetidos.
    const seen = new Set<string>();
    return ok
      .flatMap((s) => s.value)
      .sort((a, b) => a.priority - b.priority)
      .filter((r) => {
        const k = `${r.language}/${r.externalId}`;
        return seen.has(k) ? false : (seen.add(k), true);
      });
  }

  // Todas las cartas de una colección (cuando se busca solo por su código).
  async listSet(set: SetInfo, signal?: AbortSignal): Promise<CardRef[]> {
    const lang = LANG[set.language];
    const d = await getJson<{ cards?: ListItem[] }>(`${API}/${lang}/sets/${encodeURIComponent(set.id)}`, { signal, revalidate: 86400 });
    return (d.cards ?? []).map((it) => ({
      provider: this.id, externalId: it.id, language: set.language, name: it.name, localId: String(it.localId),
      hasImage: !!it.image, image: it.image,
    }));
  }

  // Imagen de respaldo de una carta: se empareja con toda su colección (las cartas con el mismo nombre,
  // como las dos mitades de una LEGEND, se reparten por orden).
  private async fallbackImage(lang: string, set: Detail["set"], releaseDate: string | undefined, id: string, signal?: AbortSignal) {
    try {
      const list = await getJson<{ name: string; cards?: ListItem[] }>(`${API}/${lang}/sets/${encodeURIComponent(set.id)}`, { signal, revalidate: 86400 });
      const ours = (list.cards ?? []).map((c) => ({ id: buildCardId("EN", set.id, String(c.localId)), name: c.name, localId: String(c.localId) }));
      const images = await imagesForSet({ key: `en-${set.id}`.toLowerCase(), name: set.name, releaseDate, total: ours.length }, ours);
      return images.get(id) ?? null;
    } catch {
      return null;
    }
  }

  async getCard(ref: CardRef, signal?: AbortSignal): Promise<Card | null> {
    const lang = LANG[ref.language];
    const d = await getJson<Detail>(`${API}/${lang}/cards/${encodeURIComponent(ref.externalId)}`, { signal, revalidate: 86400 });
    const releaseDate = await setDate(lang, d.set.id, signal);
    const id = buildCardId(ref.language, d.set.id, d.localId);
    // Sin imagen en TCGdex (colección recién salida): la de pokemontcg.io, si la tiene
    const fallback = !d.image && ref.language === "EN" ? await this.fallbackImage(lang, d.set, releaseDate, id, signal) : null;
    return {
      id,
      slug: buildSlug(d.name, id),
      name: d.name,
      set: d.set.name,
      setId: d.set.id,
      localId: String(d.localId),
      number: formatNumber(String(d.localId), d.set.cardCount?.official),
      year: year(releaseDate),
      releaseDate,
      language: ref.language,
      rarity: d.rarity && !/^none$/i.test(d.rarity) ? d.rarity : undefined,
      type: mapType(d.types?.[0]),
      imageUrl: d.image ? `${d.image}/high.webp` : (fallback?.large ?? null),
      imageThumbUrl: d.image ? `${d.image}/low.webp` : (fallback?.small ?? null),
      // assets.tcgdex.net responde con Access-Control-Allow-Origin: *; las de respaldo van por /api/img
      imageNeedsProxy: !d.image && !!fallback,
      externalIds: { [this.id]: d.id, ...(fallback ? { pokemontcg: fallback.pokemontcgId } : {}) },
      variants: d.variants ?? null,
      variantOptions: variantOptions(d.variants_detailed, d.variants),
      detailVersion: DETAIL_VERSION,
    };
  }
}
