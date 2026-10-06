import { getJson } from "./http";

// Respaldo de imágenes: las colecciones recién salidas (p. ej. 30th Classic Collection, sept. 2026)
// llegan a TCGdex sin imágenes durante un tiempo. pokemontcg.io suele tenerlas antes, pero con otros
// ids y, en reediciones, otra numeración (la Charizard de la Classic Collection es la "4", como en Base
// Set; en TCGdex es la 001). Así que se busca su colección por fecha de salida y nombre, y se emparejan
// las cartas por nombre. La parte de emparejar es pura y tiene tests.

const API = "https://api.pokemontcg.io/v2";

export interface TheirCard { id: string; name: string; number: string; images?: { small?: string; large?: string } }
export interface TheirSet { id: string; name: string; releaseDate?: string; total?: number }
export interface CardImages { small: string; large: string; pokemontcgId: string }

// "Pikachu & Zekrom-GX" y "Pikachu & Zekrom GX" -> "pikachuzekromgx"
export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

// La colección de pokemontcg.io que corresponde a la nuestra: misma fecha y el nombre más parecido
// (palabras en común), con un plus si coincide el número de cartas.
export function pickSet(ours: { name: string; total?: number }, candidates: TheirSet[]): TheirSet | null {
  const mine = tokens(ours.name);
  let best: TheirSet | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const theirs = tokens(c.name);
    const common = [...mine].filter((t) => theirs.has(t)).length;
    const score = common / new Set([...mine, ...theirs]).size + (ours.total && c.total === ours.total ? 0.5 : 0);
    if (common > 0 && score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

const numeric = (n: string) => parseInt(n.replace(/\D/g, ""), 10) || 0;

// Empareja nuestras cartas con las suyas, en tres pasadas:
//  1. mismo nombre (si hay varias con el mismo, como las dos mitades de una carta LEGEND, por orden de número);
//  2. un nombre que empieza por el otro ("Palkia" / "Palkia LV.X");
//  3. si queda exactamente una de cada lado, esas dos.
export function matchImages(ours: { id: string; name: string; localId: string }[], theirs: TheirCard[]): Map<string, CardImages> {
  const out = new Map<string, CardImages>();
  const withImg = theirs.filter((c) => c.images?.small && c.images?.large).sort((a, b) => numeric(a.number) - numeric(b.number));
  const free = new Set(withImg);
  const take = (o: { id: string }, c: TheirCard) => {
    out.set(o.id, { small: c.images!.small!, large: c.images!.large!, pokemontcgId: c.id });
    free.delete(c);
  };
  const sorted = [...ours].sort((a, b) => numeric(a.localId) - numeric(b.localId));
  for (const o of sorted) {
    const c = [...free].find((x) => normName(x.name) === normName(o.name));
    if (c) take(o, c);
  }
  for (const o of sorted) {
    if (out.has(o.id)) continue;
    const n = normName(o.name);
    const c = [...free].find((x) => n.length >= 3 && (normName(x.name).startsWith(n) || n.startsWith(normName(x.name))));
    if (c) take(o, c);
  }
  const left = sorted.filter((o) => !out.has(o.id));
  if (left.length === 1 && free.size === 1) take(left[0], [...free][0]);
  return out;
}

// ---- Servidor ----

const headers = () => (process.env.POKEMONTCG_API_KEY ? { "X-Api-Key": process.env.POKEMONTCG_API_KEY } : undefined);
const memo = new Map<string, { at: number; value: Promise<Map<string, CardImages>> }>();
const OK_TTL = 24 * 3600_000;
const FAIL_TTL = 10 * 60_000; // pokemontcg.io falla a menudo (500): no se insiste durante 10 minutos

// Imágenes de respaldo para las cartas de una colección (en memoria un día; un fallo, 10 minutos).
export function imagesForSet(
  set: { key: string; name: string; releaseDate?: string; total?: number },
  ours: { id: string; name: string; localId: string }[],
): Promise<Map<string, CardImages>> {
  const hit = memo.get(set.key);
  if (hit && Date.now() - hit.at < OK_TTL) return hit.value;
  const value = load(set, ours).catch((e) => {
    console.warn("[fallback-images]", set.key, e instanceof Error ? e.message : e);
    memo.set(set.key, { at: Date.now() - OK_TTL + FAIL_TTL, value: Promise.resolve(new Map()) });
    return new Map<string, CardImages>();
  });
  memo.set(set.key, { at: Date.now(), value });
  return value;
}

// pokemontcg.io responde a menudo 500/502 al primer intento: hasta 3 intentos, con una pausa corta.
async function getRetry<T>(url: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await getJson<T>(url, { headers: headers(), timeoutMs: 15000, revalidate: 86400 });
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

async function load(set: { name: string; releaseDate?: string; total?: number }, ours: { id: string; name: string; localId: string }[]) {
  if (!set.releaseDate) return new Map<string, CardImages>();
  const date = set.releaseDate.slice(0, 10).replace(/-/g, "/");
  // Las colecciones sin imagen son las recientes: se piden las 50 últimas y se filtra la fecha aquí
  // (pokemontcg.io no responde bien a las búsquedas por fecha)
  const sets = await getRetry<{ data: TheirSet[] }>(`${API}/sets?orderBy=-releaseDate&pageSize=50&select=id,name,releaseDate,total`);
  const theirSet = pickSet(set, sets.data.filter((s) => s.releaseDate === date));
  if (!theirSet) return new Map<string, CardImages>();
  // De 50 en 50: con páginas más grandes pokemontcg.io responde 500
  const cards: TheirCard[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await getRetry<{ data: TheirCard[]; totalCount?: number }>(
      `${API}/cards?q=${encodeURIComponent(`set.id:${theirSet.id}`)}&page=${page}&pageSize=50&select=id,name,number,images`,
    );
    cards.push(...r.data);
    if (!r.data.length || cards.length >= (r.totalCount ?? 0)) break;
  }
  return matchImages(ours, cards);
}
