// Interpreta el texto que el OCR lee de una carta fotografiada y construye búsquedas para el catálogo.
// Puro: sin cámara ni red, se testea solo.
//
// Dónde mira (ver Scanner):
//  - Abajo a la izquierda: código de colección y número ("PAF EN 054/091", "SV2a 006/165"). Se lee dos
//    veces, en grises y con umbral, porque cada versión acierta cosas distintas.
//  - Abajo a la derecha: el número en cartas antiguas ("4/102").
//  - Arriba: el nombre ("Charizard ex  330 HP").

export interface ScanReading {
  setCode: string | null; // el candidato más probable, para enseñarlo
  setCodes: string[]; // todos los candidatos, en orden: se prueban uno a uno
  number: string | null; // tal como está impreso, con ceros: "054"
  total: string | null; // "091"
  name: string | null; // "Charizard ex"
}

// Palabras que parecen código pero no lo son: idioma, textos de copyright, ilustrador...
const NOT_CODES = new Set([
  "EN", "JP", "JA", "ES", "DE", "FR", "IT", "PT", "KO", "ZH", "HP", "LV", "TM", "INC", "LLC", "GAME",
  "FREAK", "ILLUS", "THE", "AND", "RR", "RRR", "SR", "UR", "AR", "SAR", "CHR", "CSR",
]);

// "054/091", "4 / 102", "O54/O91" (el OCR confunde O y 0, l e I con 1)
const NUMBER_RE = /([0-9OoIl|]{1,3})\s*\/\s*([0-9OoIl|]{1,3})/;
const fixDigits = (s: string) => s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");

// Códigos válidos: 2-4 mayúsculas ("PAF", "OBF") o letras+cifras ("SV2a", "S12a", "sv2a": en japonés
// el OCR suele leerlos en minúscula). Las palabras en minúscula sin cifras son ruido ("re", "rd").
const isCode = (t: string) =>
  !NOT_CODES.has(t.toUpperCase()) && (/^[A-Z]{2,4}$/.test(t) || /^[A-Za-z]{1,3}\d{1,2}[A-Za-z]?$/.test(t));

// Cifras que el OCR pone en lugar de letras dentro de un código ("08F" -> "OBF").
const LETTER: Record<string, string> = { "0": "O", "8": "B", "5": "S", "1": "I", "6": "G", "2": "Z" };

// Variantes de una palabra que podrían ser el código real.
function codeVariants(t: string): string[] {
  const out: string[] = [];
  if (isCode(t)) out.push(t);
  // una letra de más pegada por el OCR: "BPAF" -> "PAF"
  if (/^[A-Z]{4}$/.test(t)) out.push(t.slice(1), t.slice(0, 3));
  // cifras en lugar de letras: "08F" -> "OBF"
  if (/^[0-9A-Z]{3,4}$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t)) {
    const fixed = t.replace(/\d/g, (d) => LETTER[d] ?? d);
    if (/^[A-Z]{3,4}$/.test(fixed)) out.push(fixed);
  }
  return out;
}

// Lee una o varias versiones del texto de abajo (en orden de fiabilidad) y junta lo encontrado.
export function readBottom(texts: string | string[]): Pick<ScanReading, "setCode" | "setCodes" | "number" | "total"> {
  let number: string | null = null, total: string | null = null;
  const near: string[][] = []; // por versión del texto: candidatos de más cerca a más lejos del número
  const far: string[] = []; // el resto de candidatos de la franja
  const words = (s: string) => s.split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (const raw of Array.isArray(texts) ? texts : [texts]) {
    const text = raw.replace(/[^\S\n]+/g, " ");
    const m = text.match(NUMBER_RE);
    if (m && !number) {
      number = fixDigits(m[1]);
      total = fixDigits(m[2]);
    }
    // el código va justo antes del número, en la misma línea
    const line = m ? text.split("\n").find((l) => l.includes(m[0])) ?? text : text;
    const before = m ? line.slice(0, line.indexOf(m[0])) : "";
    near.push(words(before).reverse().flatMap(codeVariants));
    far.push(...words(text).flatMap(codeVariants));
  }
  // se alternan las versiones por cercanía: el más cercano de cada una, luego el segundo...
  const ranked: string[] = [];
  for (let i = 0; i < Math.max(0, ...near.map((n) => n.length)); i++) for (const n of near) if (n[i]) ranked.push(n[i]);
  const setCodes = [...new Set([...ranked, ...far])].slice(0, 5);
  return { setCode: setCodes[0] ?? null, setCodes, number, total };
}

// ---- Nombre ----

const NAME_STOP = new Set([
  "evolves", "from", "put", "on", "the", "stage", "basic", "card", "tera", "pokemon", "pokémon", "trainer",
  "item", "supporter", "energy", "tool", "stadium", "hp", "ps", "pv",
]);
const SUFFIX = /^(ex|gx|v|vmax|vstar|break|prime|lv\.?x)$/i;
const PREFIX = /^(dark|light|radiant|shining|mega|alolan|galarian|hisuian|paldean|team|rocket's|[a-z]+'s)$/i;

export function readName(text: string): string | null {
  const clean = text
    .replace(/[@€£©¢][\s]?[xX¥]/g, " ex") // el "ex" estilizado sale como "@X", "€X"...
    .replace(/EVOLVES\s+FROM\s+\S+/gi, " ")
    .replace(/\b(BASIC|STAGE\s*\d|\d+\s*HP|HP\s*\d+)\b/gi, " ");
  const words = clean.split(/[^A-Za-zÀ-ÿ'’.\-]+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).map((w) => w.replace(/^[.'’\-]+|[.\-]+$/g, ""));
  // el nombre es la palabra "de verdad" más larga; se le suman prefijo ("Dark") y sufijo ("ex", "VMAX")
  let best = -1;
  words.forEach((w, i) => {
    if (w.length >= 3 && !NAME_STOP.has(w.toLowerCase()) && (best < 0 || w.length > words[best].length)) best = i;
  });
  if (best < 0) return null;
  const parts = [words[best]];
  if (best > 0 && PREFIX.test(words[best - 1])) parts.unshift(words[best - 1]);
  const next = words[best + 1];
  if (next && SUFFIX.test(next)) parts.push(/^ex$/i.test(next) ? "ex" : next);
  return parts.join(" ");
}

export function readCard(bottom: string | string[], top: string): ScanReading {
  return { ...readBottom(bottom), name: readName(top) };
}

// Búsquedas a probar, de la más precisa a la más amplia. El buscador ya entiende códigos de colección
// y números con cero ("PAF 054"), así que la primera que acierte suele ser la carta exacta.
// Las de código exigen que el código sea una colección real (`set: true`): si el OCR leyó mal, se
// descartan sin devolver cartas que solo se parecen en el nombre.
export interface ScanQuery {
  q: string;
  set: boolean;
}

export function scanQueries(r: ScanReading): ScanQuery[] {
  const out: ScanQuery[] = [];
  const add = (q: string, set: boolean) => !out.some((x) => x.q === q) && out.push({ q, set });
  if (r.number) for (const c of r.setCodes.length ? r.setCodes : r.setCode ? [r.setCode] : []) add(`${c} ${r.number}`, true);
  if (r.name && r.number) add(`${r.name} ${r.number}${r.total ? `/${r.total}` : ""}`, false);
  if (r.name) add(r.name, false);
  return out;
}
