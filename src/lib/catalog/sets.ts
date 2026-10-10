import { getStoredSets, upsertSets } from "@/lib/db/sets-repo";
import { getJson, mapLimit } from "./http";
import type { SetInfo } from "./types";

// Códigos de colección ("PAF" = Paldean Fates). Dos partes:
//  - Funciones puras para reconocer un código dentro de la búsqueda (se testean solas).
//  - La lista de colecciones: se barre en TCGdex una vez, se guarda en base de datos y se recuerda en memoria.

const API = "https://api.tcgdex.net/v2";

// ---- Reconocer un código en la búsqueda ----

// Quita todo lo que no sea letra, número o punto: "SV-04.5" y "sv04.5" son lo mismo.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "");

// ¿Esta palabra puede ser un código? Con 2 letras solo si se escribió en mayúsculas ("BS"):
// en minúsculas lo normal es que sea parte de un nombre ("ex", "gx").
export function looksLikeCode(token: string): boolean {
  if (!/^[A-Za-z0-9][A-Za-z0-9.\-]{1,9}$/.test(token) || /^\d+$/.test(token)) return false;
  return token.length >= 3 || token === token.toUpperCase();
}

// Colecciones cuyo código o id coincide con la palabra.
export function matchSets(all: SetInfo[], token: string): SetInfo[] {
  const t = norm(token);
  return t ? all.filter((s) => (s.code && norm(s.code) === t) || norm(s.id) === t) : [];
}

// Busca entre las palabras de la consulta una que sea código de colección (de derecha a izquierda:
// en "charizard PAF" es la última). Devuelve la palabra y las colecciones a las que apunta.
export function findSetToken(tokens: string[], all: SetInfo[]): { index: number; token: string; sets: SetInfo[] } | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!looksLikeCode(tokens[i])) continue;
    const sets = matchSets(all, tokens[i]);
    if (sets.length) return { index: i, token: tokens[i], sets };
  }
  return null;
}

// ---- La lista de colecciones ----

// Las colecciones de Pokémon TCG Pocket (el juego del móvil) vienen mezcladas en TCGdex con las físicas,
// pero no son cartas reales: sin precio de mercado ni imágenes. Sus ids van en mayúscula ("A1", "A2b",
// "B2a", "P-A"); las físicas, en minúscula ("base1", "g1", "sv04.5").
export const isPocketSet = (s: Pick<SetInfo, "id" | "language">) => s.language === "EN" && /^(P-[A-Z]|[A-Z]\d+[a-z]?)$/.test(s.id);
const physical = (list: SetInfo[]) => list.filter((s) => !isPocketSet(s));

interface ListItem { id: string; name: string }
interface SetDetail { abbreviation?: { official?: string }; tcgOnline?: string; releaseDate?: string; serie?: { id?: string } }

// Barre TCGdex. En inglés hay que pedir el detalle de cada colección porque el listado no trae el código
// (unas 220 peticiones, ~10 s la primera vez). En japonés el código es el propio id y basta el listado.
export async function buildSets(signal?: AbortSignal): Promise<SetInfo[]> {
  const [en, ja] = await Promise.all([
    getJson<ListItem[]>(`${API}/en/sets`, { signal, revalidate: 86400, timeoutMs: 15000 }),
    getJson<ListItem[]>(`${API}/ja/sets`, { signal, revalidate: 86400, timeoutMs: 15000 }),
  ]);
  const enSets = await mapLimit(en, 10, async (s): Promise<SetInfo | null> => {
    const d = await getJson<SetDetail>(`${API}/en/sets/${encodeURIComponent(s.id)}`, { signal, revalidate: 604800 }).catch(() => null);
    if (d?.serie?.id === "tcgp") return null; // TCG Pocket (también las futuras, aunque cambien los ids)
    return {
      key: `en-${s.id}`.toLowerCase(), id: s.id, language: "EN", name: s.name,
      code: d?.abbreviation?.official ?? d?.tcgOnline ?? null, releaseDate: d?.releaseDate,
    };
  });
  const jaSets = ja.map((s): SetInfo => ({ key: `jp-${s.id}`.toLowerCase(), id: s.id, language: "JP", name: s.name, code: s.id }));
  return physical([...enSets.filter((s): s is SetInfo => !!s), ...jaSets]);
}

const WEEK = 7 * 864e5;
const g = globalThis as unknown as { __slabSets?: Promise<SetInfo[]> };

async function persist(list: SetInfo[]) {
  try {
    await upsertSets(list);
  } catch (e) {
    console.warn("[sets] no se pudo guardar:", e instanceof Error ? e.message : e);
  }
}

// Vuelve a barrer y guarda. Lo llama el cron diario (y el refresco en segundo plano).
export async function refreshSets(): Promise<number> {
  const built = await buildSets();
  await persist(built);
  g.__slabSets = Promise.resolve(built);
  return built.length;
}

async function load(): Promise<SetInfo[]> {
  try {
    const stored = await getStoredSets();
    if (stored.sets.length) {
      // las colecciones nuevas salen cada pocas semanas: si lo guardado es viejo, se refresca sin esperar
      if (!stored.updatedAt || Date.now() - stored.updatedAt.getTime() > 2 * WEEK) void refreshSets().catch(() => {});
      return physical(stored.sets); // lo guardado antes de filtrar TCG Pocket puede traerlas
    }
  } catch (e) {
    console.warn("[sets] lectura de base de datos:", e instanceof Error ? e.message : e);
  }
  const built = await buildSets(); // primera vez: tarda unos segundos
  await persist(built);
  return built;
}

export function getSets(): Promise<SetInfo[]> {
  if (!g.__slabSets) {
    g.__slabSets = load().catch((e) => {
      g.__slabSets = undefined; // reintento en la siguiente búsqueda
      throw e;
    });
  }
  return g.__slabSets;
}
