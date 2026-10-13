import { getJson, mapLimit } from "./http";

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

// Imágenes construidas directamente en un CDN, sin pasar por la API de pokemontcg.io (que falla a menudo
// con 500/502). Tres tablas, comprobadas carta a carta (primera, del medio y última) en octubre de 2026:
//  - DIRECT_SETS: colecciones con la misma numeración en pokemontcg.io -> images.pokemontcg.io/<id>/<n>.png
//  - SCRYDEX_SETS: las que pokemontcg.io no tiene pero Scrydex (su CDN nuevo) sí -> images.scrydex.com/pokemon/<id>-<n>/large.
//    Si Scrydex no tiene una carta concreta responde 200 con una imagen genérica (un reverso), así que cada
//    carta se comprueba con una petición HEAD (ver scrydexImages) antes de usarla.
//  - REPRINTS: reediciones con otra numeración (allí llevan el número de la carta original): tabla fija
//    carta a carta, emparejada por nombre.
// Las que no están en ninguna tabla siguen por la API (findTheirSet + matchImages).
const PTCG = "https://images.pokemontcg.io";
const SCRYDEX = "https://images.scrydex.com/pokemon";
export const DIRECT_SETS: Record<string, string> = {
  "en-bog": "bp", "en-tk-ex-latia": "tk1a", "en-tk-ex-latio": "tk1b", "en-tk-ex-p": "tk2a", "en-tk-ex-m": "tk2b",
  "en-exu": "ex10", "en-pop6": "pop6", "en-pl2": "pl2", "en-hgssp": "hsp", "en-bwp": "bwp", "en-xyp": "xyp", "en-xy8": "xy8",
  "en-2011bw": "mcd11", "en-2012bw": "mcd12", "en-2016xy": "mcd16", "en-2019sm": "mcd19", "en-2021swsh": "mcd21", "en-2022swsh": "mcd22",
  "en-smp": "smp", "en-sm2": "sm2", "en-sm3.5": "sm35", "en-sm6": "sm6", "en-sm7.5": "sm75",
  "en-swshp": "swshp", "en-swsh4.5sv": "swsh45sv", "en-cel25": "cel25", "en-swsh12.5gg": "swsh12pt5gg",
  "en-swsh9tg": "swsh9tg", "en-swsh10tg": "swsh10tg", "en-swsh11tg": "swsh11tg", "en-swsh12tg": "swsh12tg",
};
export const SCRYDEX_SETS: Record<string, string> = {
  // kits de entrenador
  "en-tk-dp-l": "tk3a", "en-tk-dp-m": "tk3b", "en-tk-hs-r": "tk4a", "en-tk-hs-g": "tk4b", "en-tk-bw-e": "tk5a", "en-tk-bw-z": "tk5b",
  "en-tk-xy-sy": "tk6a", "en-tk-xy-n": "tk6b", "en-tk-xy-b": "tk7a", "en-tk-xy-w": "tk7b", "en-tk-xy-latia": "tk8a", "en-tk-xy-latio": "tk8b",
  "en-tk-xy-su": "tk9a", "en-tk-xy-p": "tk9b", "en-tk-sm-l": "tk10a", "en-tk-sm-r": "tk10b",
  // McDonald's
  "en-2014xy": "mcd14", "en-2015xy": "mcd15", "en-2017sm": "mcd17", "en-2018sm": "mcd18", "en-2023sv": "mcd23", "en-2024sv": "mcd24",
  // energías, promos y e-Card (en estas últimas faltan algunas cartas sueltas)
  "en-sve": "sve", "en-mee": "mee", "en-svp": "svp", "en-mep": "mep", "en-ecard2": "ecard2", "en-ecard3": "ecard3",
};
export const REPRINTS: Record<string, { cdn: "ptcg" | "scrydex"; set: string; numbers: Record<string, string> }> = {
  "en-cel25cc": {
    cdn: "ptcg", set: "cel25c",
    numbers: {
      CC001: "2_A", CC002: "4_A", CC003: "15_A1", CC004: "73_A", CC005: "8_A", CC006: "15_A2", CC007: "15_A3", CC008: "24_A",
      CC009: "20_A", CC010: "66_A", CC011: "9_A", CC012: "86_A", CC013: "88_A", CC014: "93_A", CC015: "17_A", CC016: "15_A4",
      CC017: "109_A", CC018: "145_A", CC019: "107_A", CC020: "113_A", CC021: "114_A", CC022: "54_A", CC023: "97_A", CC024: "76_A", CC025: "60_A",
    },
  },
  "en-30th-c": {
    cdn: "scrydex", set: "me55c",
    numbers: {
      "001": "4", "002": "5", "003": "11", "004": "11g", "005": "18", "006": "19", "007": "25", "008": "33", "009": "41", "010": "43",
      "011": "47", "012": "50", "013": "57", "014": "58", "015": "69", "016": "85", "017": "89", "018": "94", "019": "100", "020": "99",
      "021": "101", "022": "106p", "023": "106m", "024": "106", "025": "108", "026": "114", "027": "123", "028": "138", "029": "149", "030": "203",
    },
  },
};

// "001" -> "1" (sus números no llevan ceros delante); "GG01", "SV001", "SM125" se quedan igual.
const theirNumber = (localId: string) => encodeURIComponent(localId.replace(/^0+(?=\d)/, ""));
const ptcgImages = (set: string, n: string): CardImages => ({ small: `${PTCG}/${set}/${n}.png`, large: `${PTCG}/${set}/${n}_hires.png`, pokemontcgId: `${set}-${n}` });
const scrydexUrls = (set: string, n: string): CardImages => ({ small: `${SCRYDEX}/${set}-${n}/small`, large: `${SCRYDEX}/${set}-${n}/large`, pokemontcgId: `${set}-${n}` });

// Las de DIRECT_SETS y REPRINTS (sin red). null si la colección no está en esas tablas.
export function directImages(setKey: string, ours: { id: string; localId: string }[]): Map<string, CardImages> | null {
  const direct = DIRECT_SETS[setKey];
  if (direct) return new Map(ours.map((o) => [o.id, ptcgImages(direct, theirNumber(o.localId))]));
  const re = REPRINTS[setKey];
  if (re) {
    const out = new Map<string, CardImages>();
    for (const o of ours) {
      const n = re.numbers[o.localId];
      if (n) out.set(o.id, (re.cdn === "ptcg" ? ptcgImages : scrydexUrls)(re.set, encodeURIComponent(n)));
    }
    return out;
  }
  return null;
}

// Las de SCRYDEX_SETS, sin comprobar (la comprobación necesita red: ver scrydexImages). null si no está.
// En Scrydex los números tampoco llevan ceros tras las letras: "H01" -> "H1" (las holo de Aquapolis y Skyridge).
const scrydexNumber = (localId: string) => encodeURIComponent(localId.replace(/^([A-Za-z]*)0+(?=\d)/, "$1"));
export function scrydexCandidates(setKey: string, ours: { id: string; localId: string }[]): Map<string, CardImages> | null {
  const set = SCRYDEX_SETS[setKey];
  return set ? new Map(ours.map((o) => [o.id, scrydexUrls(set, scrydexNumber(o.localId))])) : null;
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
  const candidates = scrydexCandidates(set.key, ours);
  const value = (candidates ? scrydexImages(candidates) : load(set, ours)).catch((e) => {
    console.warn("[fallback-images]", set.key, e instanceof Error ? e.message : e);
    memo.set(set.key, { at: Date.now() - OK_TTL + FAIL_TTL, value: Promise.resolve(new Map()) });
    return new Map<string, CardImages>();
  });
  memo.set(set.key, { at: Date.now(), value });
  return value;
}

// Scrydex responde 200 también cuando no tiene la carta, con una imagen genérica (un reverso) que pesa
// siempre lo mismo. Una petición HEAD por carta (solo cabeceras, sin descargar la imagen) basta para
// descartarla. Las que fallan por red también se descartan: mejor sin imagen que con una rota.
// (Sin "identity" el CDN responde comprimido y sin Content-Length; por eso también se mira su ETag, que es fijo.)
const SCRYDEX_PLACEHOLDER_BYTES = "186316";
const SCRYDEX_PLACEHOLDER_ETAG = "cfl2loWl84E8tUjrC-Q-I0D0J";
async function scrydexImages(candidates: Map<string, CardImages>): Promise<Map<string, CardImages>> {
  const entries = [...candidates];
  const real = await mapLimit(entries, 8, async ([, img]) => {
    try {
      const r = await fetch(img.large, { method: "HEAD", headers: { "Accept-Encoding": "identity" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
      const placeholder = r.headers.get("content-length") === SCRYDEX_PLACEHOLDER_BYTES || !!r.headers.get("etag")?.includes(SCRYDEX_PLACEHOLDER_ETAG);
      return r.ok && !placeholder;
    } catch {
      return false;
    }
  });
  return new Map(entries.filter((_, i) => real[i]));
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
