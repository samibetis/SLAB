import { getJson } from "./http";

// Respaldo de imágenes: TCGdex no tiene imágenes de unas 70 colecciones físicas. Unas son recién salidas
// (30th Classic Collection) y otras antiguas: Shining Legends, Dragon Majesty, las Trainer Gallery, Shiny
// Vault, McDonald's, kits de entrenador, parte de las promos... pokemontcg.io suele tenerlas, pero con otros
// ids y, en reediciones, otra numeración (la Charizard de la Classic Collection es la "4", como en Base
// Set; en TCGdex es la 001). Así que se busca su colección por fecha de salida y nombre, y se emparejan
// las cartas por número y nombre, o solo por nombre. La parte de elegir y emparejar es pura y tiene tests.

const API = "https://api.pokemontcg.io/v2";

export interface TheirCard { id: string; name: string; number: string; images?: { small?: string; large?: string } }
export interface TheirSet { id: string; name: string; releaseDate?: string; total?: number }
export interface CardImages { small: string; large: string; pokemontcgId: string }

// "Pikachu & Zekrom-GX" y "Pikachu & Zekrom GX" -> "pikachuzekromgx"
export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

// La colección de pokemontcg.io que corresponde a la nuestra, entre las candidatas (las de su fecha): el
// nombre más parecido (palabras en común), con un plus si coincide el número de cartas. `minScore` exige
// un parecido mínimo (para las candidatas de fechas cercanas, que pueden ser otra colección).
export function pickSet(ours: { name: string; total?: number }, candidates: TheirSet[], minScore = 0): TheirSet | null {
  const mine = tokens(ours.name);
  let best: TheirSet | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const theirs = tokens(c.name);
    const common = [...mine].filter((t) => theirs.has(t)).length;
    const score = common / new Set([...mine, ...theirs]).size + (ours.total && c.total === ours.total ? 0.5 : 0);
    if (common > 0 && score >= minScore && score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

const numeric = (n: string) => parseInt(n.replace(/\D/g, ""), 10) || 0;
// "001" -> "1", "SM01" -> "sm1", "GG07" -> "gg7": el mismo número escrito con o sin ceros
const normNumber = (n: string) => n.toLowerCase().replace(/(^|[a-z])0+(?=\d)/g, "$1");

const DAY = 864e5;
const dayOf = (d: string) => Date.parse(d.slice(0, 10).replace(/\//g, "-"));

// Las candidatas para una colección nuestra. Primero, las que salieron el mismo día; si ninguna se parece,
// las de hasta 45 días antes o después con un nombre muy parecido (las dos APIs no siempre dan la misma fecha).
export function findTheirSet(ours: { name: string; releaseDate?: string; total?: number }, all: TheirSet[]): TheirSet | null {
  if (!ours.releaseDate) return null;
  const mine = dayOf(ours.releaseDate);
  const dated = all.filter((s) => s.releaseDate);
  const same = dated.filter((s) => dayOf(s.releaseDate!) === mine);
  const near = dated.filter((s) => Math.abs(dayOf(s.releaseDate!) - mine) <= 45 * DAY);
  return pickSet(ours, same) ?? pickSet(ours, near, 0.75);
}

// Empareja nuestras cartas con las suyas, en cuatro pasadas:
//  0. mismo número y mismo nombre (en las promos hay muchas cartas con el mismo nombre: así no se cruzan);
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
    const c = [...free].find((x) => normNumber(x.number) === normNumber(o.localId) && normName(x.name) === normName(o.name));
    if (c) take(o, c);
  }
  for (const o of sorted) {
    if (out.has(o.id)) continue;
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

// Colecciones de TCGdex sin imágenes cuya numeración es la misma en pokemontcg.io: la imagen se construye
// directamente en su CDN (images.pokemontcg.io/<su colección>/<número>.png), sin pasar por su API, que
// falla a menudo. Comprobado carta a carta (primera, del medio y última) en octubre de 2026. Las que tienen
// otra numeración (reediciones como Celebrations Classic Collection) o aún no están allí siguen por la API.
const IMG = "https://images.pokemontcg.io";
export const DIRECT_SETS: Record<string, string> = {
  "en-bog": "bp", "en-tk-ex-latia": "tk1a", "en-tk-ex-latio": "tk1b", "en-tk-ex-p": "tk2a", "en-tk-ex-m": "tk2b",
  "en-exu": "ex10", "en-pop6": "pop6", "en-pl2": "pl2", "en-hgssp": "hsp", "en-bwp": "bwp", "en-xyp": "xyp", "en-xy8": "xy8",
  "en-2011bw": "mcd11", "en-2012bw": "mcd12", "en-2016xy": "mcd16", "en-2019sm": "mcd19", "en-2021swsh": "mcd21", "en-2022swsh": "mcd22",
  "en-smp": "smp", "en-sm2": "sm2", "en-sm3.5": "sm35", "en-sm6": "sm6", "en-sm7.5": "sm75",
  "en-swshp": "swshp", "en-swsh4.5sv": "swsh45sv", "en-cel25": "cel25", "en-swsh12.5gg": "swsh12pt5gg",
  "en-swsh9tg": "swsh9tg", "en-swsh10tg": "swsh10tg", "en-swsh11tg": "swsh11tg", "en-swsh12tg": "swsh12tg",
};

// "001" -> "1" (sus números no llevan ceros delante); "GG01", "SV001", "SM125" se quedan igual.
export function directImages(setKey: string, ours: { id: string; localId: string }[]): Map<string, CardImages> | null {
  const theirs = DIRECT_SETS[setKey];
  if (!theirs) return null;
  return new Map(
    ours.map((o) => {
      const n = encodeURIComponent(o.localId.replace(/^0+(?=\d)/, ""));
      return [o.id, { small: `${IMG}/${theirs}/${n}.png`, large: `${IMG}/${theirs}/${n}_hires.png`, pokemontcgId: `${theirs}-${n}` }];
    }),
  );
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
  const direct = directImages(set.key, ours);
  if (direct) return Promise.resolve(direct);
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

// Todas las colecciones de pokemontcg.io (unas 170), de 50 en 50 y guardadas en memoria un día.
// pokemontcg.io no responde bien a las búsquedas por fecha, así que se filtra aquí.
let theirSetsMemo: { at: number; value: Promise<TheirSet[]> } | null = null;
function theirSets(): Promise<TheirSet[]> {
  if (theirSetsMemo && Date.now() - theirSetsMemo.at < OK_TTL) return theirSetsMemo.value;
  const value = (async () => {
    const all: TheirSet[] = [];
    for (let page = 1; page <= 10; page++) {
      const r = await getRetry<{ data: TheirSet[] }>(`${API}/sets?orderBy=-releaseDate&page=${page}&pageSize=50&select=id,name,releaseDate,total`);
      all.push(...r.data);
      if (r.data.length < 50) break;
    }
    return all;
  })();
  value.catch(() => (theirSetsMemo = null)); // un fallo no se recuerda: se reintenta en la siguiente
  theirSetsMemo = { at: Date.now(), value };
  return value;
}

async function load(set: { name: string; releaseDate?: string; total?: number }, ours: { id: string; name: string; localId: string }[]) {
  if (!set.releaseDate) return new Map<string, CardImages>();
  const theirSet = findTheirSet(set, await theirSets());
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
