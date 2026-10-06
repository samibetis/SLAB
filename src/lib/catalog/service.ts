import { isFreshCard, type Card, type CardLanguage } from "@/lib/cards/types";
import { getCardsByIds, upsertCards } from "@/lib/db/cards-repo";
import { mapLimit } from "./http";
import { parseQuery, pickByNumber, rankCards, rankRefs } from "./normalize";
import { PokemonTcgProvider } from "./pokemontcg";
import { findSetToken, getSets, looksLikeCode } from "./sets";
import { TcgdexProvider } from "./tcgdex";
import type { CardRef, ParsedQuery, SetInfo } from "./types";

// Orquesta el catálogo: proveedor principal, respaldo en inglés, códigos de colección,
// caché en base de datos y ranking.
const primary = new TcgdexProvider();
const fallback = new PokemonTcgProvider();

const MAX_DETAIL = 16; // cuántos candidatos se completan con su detalle
const MAX_RESULTS = 8;
const TTL = 10 * 60_000;
const memo = new Map<string, { at: number; result: SearchResult }>();

export interface SearchResult {
  cards: Card[];
  // Si la búsqueda llevaba el código de una colección ("PAF"), cuál se ha entendido.
  matchedSet: { code: string | null; name: string } | null;
}

// requireSet: solo responde si la búsqueda lleva un código de colección real (lo usa el escáner para
// descartar rápido candidatos de código que el OCR leyó mal, sin caer en la búsqueda por nombre).
type Opts = { languages?: CardLanguage[]; signal?: AbortSignal; requireSet?: boolean };

const refId = (r: CardRef) => r.card?.id ?? `${r.language.toLowerCase()}-${r.externalId}`.toLowerCase();

// La caché en base de datos es una ayuda: si falla, la búsqueda sigue funcionando.
async function safe<T>(label: string, p: Promise<T>, empty: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
    console.warn(`[catalog] ${label}:`, (e instanceof Error ? e.message : String(e)) + cause);
    return empty;
  }
}

export async function searchCards(raw: string, opts: Opts = {}): Promise<SearchResult> {
  const languages = opts.languages?.length ? opts.languages : (["EN", "JP"] as CardLanguage[]);
  const key = `${languages.join()}|${opts.requireSet ? "set|" : ""}${raw.trim().toLowerCase()}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.result;

  const result = await resolveSearch(raw, { ...opts, languages });
  if (memo.size > 200) memo.clear();
  memo.set(key, { at: Date.now(), result });
  return result;
}

async function resolveSearch(raw: string, opts: Opts & { languages: CardLanguage[] }): Promise<SearchResult> {
  const q = parseQuery(raw);
  if (!q.tokens.length) return { cards: [], matchedSet: null };

  // ¿Alguna palabra es el código de una colección? ("charizard PAF", "PAF 54", "SV4a")
  const setHit = await findSetInQuery(q, opts.languages);
  if (setHit) {
    const rest = q.tokens.filter((_, i) => i !== setHit.index);
    // Una palabra suelta puede ser a la vez código y nombre: "MEW" es el código de la colección 151 y
    // también un Pokémon. Si hay cartas con ese nombre, gana el nombre.
    if (!rest.length && !q.number) {
      const byName = await searchByName(raw, q, opts);
      if (byName.some((c) => c.name.toLowerCase().startsWith(q.tokens[0].toLowerCase()))) return { cards: byName, matchedSet: null };
    }
    const cards = await searchInSets(q, rest, setHit.sets, opts);
    if (cards.length) {
      const s = setHit.sets[0];
      return { cards, matchedSet: { code: s.code, name: s.name } };
    }
    // Nada dentro de esa colección: se trata la palabra como una más.
  }
  if (opts.requireSet) return { cards: [], matchedSet: null };
  return { cards: await searchByName(raw, q, opts), matchedSet: null };
}

// Código de colección dentro de la consulta. Si no se puede cargar la lista de colecciones,
// se sigue sin ella: la búsqueda por nombre no depende de esto.
async function findSetInQuery(q: ParsedQuery, languages: CardLanguage[]) {
  if (!q.tokens.some(looksLikeCode)) return null;
  try {
    const hit = findSetToken(q.tokens, await getSets());
    const sets = hit?.sets.filter((s) => languages.includes(s.language)) ?? [];
    return hit && sets.length ? { ...hit, sets } : null;
  } catch (e) {
    console.warn("[catalog] colecciones:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Búsqueda por nombre (y colección por nombre, número...), como hasta ahora.
async function searchByName(raw: string, q: ParsedQuery, opts: Opts & { languages: CardLanguage[] }): Promise<Card[]> {
  const first = await run(q, opts);
  if (first.length) return first;
  // "Bulbasaur 151": ¿número de carta o nombre de colección? Si como número no sale nada, se prueba como palabra.
  return q.number ? run(parseQuery(raw, { numberAsWord: true }), opts) : first;
}

// Búsqueda dentro de las colecciones que corresponden a un código.
async function searchInSets(q: ParsedQuery, rest: string[], sets: SetInfo[], opts: Opts & { languages: CardLanguage[] }): Promise<Card[]> {
  const limited = sets.slice(0, 3);
  let refs: CardRef[] = [];
  try {
    if (rest.length) {
      // con nombre: "charizard PAF" -> Charizard dentro de esa colección
      const sub: ParsedQuery = { ...q, tokens: rest, splits: [{ name: rest.join(" "), set: null }] };
      refs = await primary.search(sub, { languages: opts.languages, sets: limited, signal: opts.signal });
      return resolve(refs, sub, opts.signal);
    }
    // solo el código: las cartas de la colección, las de número más alto primero (suelen ser las más buscadas)
    refs = (await Promise.all(limited.map((s) => primary.listSet!(s, opts.signal)))).flat();
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    console.warn("[catalog] búsqueda por colección:", e instanceof Error ? e.message : e);
    return [];
  }
  const n = (r: CardRef) => (/^\d+$/.test(r.localId) ? parseInt(r.localId, 10) : -1);
  const byNumber = q.number ? pickByNumber(refs, q.number) : refs.sort((a, b) => n(b) - n(a));
  return resolve(byNumber, q, opts.signal);
}

async function run(q: ParsedQuery, opts: Opts & { languages: CardLanguage[] }): Promise<Card[]> {
  if (!q.tokens.length) return [];

  // 1. Listado en el proveedor principal
  let refs: CardRef[] = [];
  let primaryError: unknown = null;
  try {
    refs = await primary.search(q, { languages: opts.languages, signal: opts.signal });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    primaryError = e;
  }
  // 2. Respaldo en inglés si el principal falla o no encuentra nada en inglés
  if (opts.languages.includes("EN") && !refs.some((r) => r.language === "EN")) {
    try {
      refs = [...refs, ...(await fallback.search(q, { languages: ["EN"], signal: opts.signal }))];
      primaryError = null;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      // Si el principal respondió bien (aunque sin resultados), el fallo del respaldo no es un error.
      console.warn("[catalog] respaldo pokemontcg.io:", e instanceof Error ? e.message : e);
      primaryError ??= null;
    }
  }
  if (primaryError && !refs.length) throw primaryError;
  return resolve(refs, q, opts.signal);
}

// Todas las cartas de una colección con su detalle (versiones incluidas), para los master sets.
// Las que ya están en base de datos con el formato actual no se vuelven a pedir; las demás se piden
// de 8 en 8 y se guardan, así que solo la primera vez que alguien abre la colección tarda (1-2 s).
export async function listSetDetailed(set: SetInfo, signal?: AbortSignal): Promise<{ refs: CardRef[]; cards: Map<string, Card> }> {
  const refs = await primary.listSet(set, signal);
  const known = await safe("lectura de caché", getCardsByIds(refs.map(refId)), [] as Card[]);
  const fresh = known.filter(isFreshCard);
  const knownIds = new Set(fresh.map((c) => c.id));
  const missing = refs.filter((r) => !knownIds.has(refId(r)));
  const fetched = (await mapLimit(missing, 8, (r) => primary.getCard(r, signal).catch(() => null))).filter((c): c is Card => !!c);
  if (fetched.length) await safe("escritura de caché", upsertCards(fetched), undefined);
  return { refs, cards: new Map([...fresh, ...fetched].map((c) => [c.id, c])) };
}

// Del listado a las cartas completas: detalle de los mejores candidatos (los que ya están en base de
// datos no se vuelven a pedir), número exacto si se indicó, ranking final y recorte.
async function resolve(refs: CardRef[], q: ParsedQuery, signal?: AbortSignal): Promise<Card[]> {
  const top = rankRefs(refs, q).slice(0, MAX_DETAIL);
  const known = await safe("lectura de caché", getCardsByIds(top.map(refId)), [] as Card[]);
  // Las filas guardadas con un formato anterior (sin versiones, fecha o ids de TCGplayer) se vuelven a pedir.
  const fresh = known.filter((c) => isFreshCard(c) && !!c.releaseDate);
  const knownIds = new Set(fresh.map((c) => c.id));
  const missing = top.filter((r) => !knownIds.has(refId(r)));
  const fetched = (
    await mapLimit(missing, 6, (r) => (r.card ? Promise.resolve(r.card) : primary.getCard(r, signal)).catch(() => null))
  ).filter((c): c is Card => !!c);
  if (fetched.length) await safe("escritura de caché", upsertCards(fetched), undefined);

  let cards = [...fresh, ...fetched];
  if (q.number) cards = pickByNumber(cards, q.number);
  return rankCards(cards, q).slice(0, MAX_RESULTS);
}
