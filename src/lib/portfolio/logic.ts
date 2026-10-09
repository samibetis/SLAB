import { GRADERS, GRADER_IDS, type GraderId } from "@/lib/grading/companies";
import { gradeKey } from "@/lib/prices/grades";
import type { Row } from "@/lib/prices/types";
import type { Holding } from "./types";

// Lógica pura del portafolio: qué precio le toca a cada slab, valor total, ganancia o pérdida,
// evolución mes a mes y reparto por empresa. Sin navegador ni red: recibe las series ya cargadas.

// Series mensuales por carta y versión ("en-sv4pt5-54|standard" -> filas con las claves de grado).
export type SeriesMap = Map<string, Row[]>;
export const seriesKey = (h: Pick<Holding, "card" | "variant">) => `${h.card.id}|${h.variant}`;

const month = (date: string) => date.slice(0, 7);

// "2026-03" + (-12) -> "2025-03"
export function addMonths(t: string, n: number): string {
  const total = +t.slice(0, 4) * 12 + (+t.slice(5, 7) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// Meses de a a b, ambos incluidos.
export function monthRange(a: string, b: string): string[] {
  const out: string[] = [];
  for (let t = a; t <= b && out.length < 600; t = addMonths(t, 1)) out.push(t);
  return out;
}

// Clave de precio de la nota del slab ("psa10", "bgs9.5", "psa6"). Cualquier nota vale: si nadie le
// pone precio (ni el servidor ni el usuario), el slab se enseña pero no entra en el valor total.
// La Pristine 10 de CGC/SGC/TAG cotiza como su 10 (aproximación hasta tener un proveedor real).
export function priceKey(h: Pick<Holding, "grader" | "gradeId">): string | null {
  const opt = GRADERS[h.grader]?.grades.find((o) => o.id === h.gradeId);
  return opt ? gradeKey(h.grader, opt.value) : null;
}

// Precio de un grado en un mes: el último conocido hasta ese mes (los meses sin ventas arrastran el
// anterior). null si la serie aún no había empezado.
export function priceAt(rows: Row[], key: string, t: string): number | null {
  let last: number | null = null;
  for (const r of rows) {
    if (r.t > t) break;
    const p = r.p[key];
    if (p != null) last = p;
  }
  return last;
}

export const lastMonthOf = (rows: Row[]) => (rows.length ? rows[rows.length - 1].t : null);

export interface HoldingStat {
  h: Holding;
  key: string | null;
  price: number | null; // valor actual (último mes con dato)
  pnl: number | null; // valor - coste
  pnlPct: number | null;
  spark: number[]; // precio de su nota desde la compra (o el último año si hay menos de 2 puntos)
}

export function holdingStat(h: Holding, series: SeriesMap): HoldingStat {
  const key = priceKey(h);
  const rows = series.get(seriesKey(h));
  const end = rows && lastMonthOf(rows);
  if (!key || !rows || !end) return { h, key, price: null, pnl: null, pnlPct: null, spark: [] };
  const price = priceAt(rows, key, end);
  const pnl = price == null ? null : price - h.cost;
  const from = month(h.bought) < end ? month(h.bought) : end;
  let spark = rows.filter((r) => r.t >= from && r.p[key] != null).map((r) => r.p[key]!);
  if (spark.length < 2) spark = rows.filter((r) => r.t >= addMonths(end, -11) && r.p[key] != null).map((r) => r.p[key]!);
  return { h, key, price, pnl, pnlPct: pnl == null || !(h.cost > 0) ? null : pnl / h.cost, spark };
}

export interface TimelinePoint {
  t: string;
  value: number; // lo que valían ese mes los slabs que ya tenías
  cost: number; // lo que habías pagado por esos mismos slabs
  count: number;
}

// Evolución mes a mes desde la primera compra. Cada slab cuenta desde el mes en que lo compraste y
// solo si ese mes tiene precio, para que valor y coste comparen siempre los mismos slabs.
export function timeline(holdings: Holding[], series: SeriesMap): TimelinePoint[] {
  // solo los slabs cuya nota tiene algún precio
  const priced = holdings.filter((h) => {
    const k = priceKey(h);
    return !!k && !!series.get(seriesKey(h))?.some((r) => r.p[k] != null);
  });
  if (!priced.length) return [];
  const start = priced.map((h) => month(h.bought)).sort()[0];
  const end = priced.map((h) => lastMonthOf(series.get(seriesKey(h))!)!).sort().at(-1)!;
  return monthRange(start < end ? start : end, end).map((t) => {
    let value = 0;
    let cost = 0;
    let count = 0;
    for (const h of priced) {
      if (month(h.bought) > t) continue;
      const p = priceAt(series.get(seriesKey(h))!, priceKey(h)!, t);
      if (p == null) continue;
      value += p;
      cost += h.cost;
      count++;
    }
    return { t, value, cost, count };
  });
}

// Cómo se ha movido el mercado de tus slabs en los últimos n meses, sin contar lo que has ido
// comprando: compara el precio de hoy de cada slab con el de hace n meses (o el de su mes de compra,
// si es más reciente). null si ningún slab tiene precio en ambos extremos.
export function marketChange(holdings: Holding[], series: SeriesMap, n: number): number | null {
  let from = 0;
  let to = 0;
  for (const h of holdings) {
    const key = priceKey(h);
    const rows = series.get(seriesKey(h));
    const end = rows && lastMonthOf(rows);
    if (!key || !rows || !end) continue;
    const ago = isFinite(n) ? addMonths(end, -n) : "0000-01";
    const start = month(h.bought) > ago ? month(h.bought) : ago;
    const a = priceAt(rows, key, start) ?? (isFinite(n) ? null : rows.find((r) => r.p[key] != null)?.p[key] ?? null);
    const b = priceAt(rows, key, end);
    if (a == null || b == null || start >= end) continue;
    from += a;
    to += b;
  }
  return from > 0 ? to / from - 1 : null;
}

export interface GraderSlice {
  grader: GraderId;
  count: number;
  value: number;
  share: number; // 0..1 del valor total
}

export interface Summary {
  stats: HoldingStat[];
  count: number;
  value: number; // slabs con precio
  cost: number; // coste de esos mismos slabs
  pnl: number;
  pnlPct: number | null;
  unpriced: { count: number; cost: number }; // sin precio para su nota: fuera del total
  byGrader: GraderSlice[]; // de más a menos valor; solo empresas con slabs
  best: HoldingStat | null;
  worst: HoldingStat | null;
}

export function summarize(holdings: Holding[], series: SeriesMap): Summary {
  const stats = holdings.map((h) => holdingStat(h, series));
  const priced = stats.filter((s) => s.price != null);
  const value = priced.reduce((a, s) => a + s.price!, 0);
  const cost = priced.reduce((a, s) => a + s.h.cost, 0);
  const unpriced = stats.filter((s) => s.price == null);
  const byGrader = GRADER_IDS.map((grader) => {
    const mine = stats.filter((s) => s.h.grader === grader);
    const v = mine.reduce((a, s) => a + (s.price ?? 0), 0);
    return { grader, count: mine.length, value: v, share: value > 0 ? v / value : 0 };
  })
    .filter((g) => g.count > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const ranked = priced.filter((s) => s.pnlPct != null).sort((a, b) => b.pnlPct! - a.pnlPct!);
  return {
    stats,
    count: holdings.length,
    value,
    cost,
    pnl: value - cost,
    pnlPct: cost > 0 ? value / cost - 1 : null,
    unpriced: { count: unpriced.length, cost: unpriced.reduce((a, s) => a + s.h.cost, 0) },
    byGrader,
    best: ranked[0] ?? null,
    worst: ranked.length > 1 ? ranked.at(-1)! : null,
  };
}

// Las series que hay que pedir: una por carta y versión, con las claves de grado que usan sus slabs.
export function seriesRequests(holdings: Holding[]) {
  const m = new Map<string, { id: string; ext: string; lang: string; variant: string; keys: string[] }>();
  for (const h of holdings) {
    const key = priceKey(h);
    if (!key) continue;
    const r = m.get(seriesKey(h)) ?? { id: h.card.id, ext: h.card.externalId, lang: h.card.language, variant: h.variant, keys: [] };
    if (!r.keys.includes(key)) r.keys.push(key);
    m.set(seriesKey(h), r);
  }
  return [...m.values()];
}

// "1.234,50", "1234.50", "$ 90" -> número. Si aparecen punto y coma, el último es el decimal. Con un solo
// signo depende del idioma: en español la coma es decimal y "1.500" son miles; en inglés, al revés
// ("1,500" son miles y "12,5" se lee como decimal porque no son tres cifras).
export function parseAmount(text: string, lang: "es" | "en" = "es"): number | null {
  let s = text.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    s = s.replace(dec === "." ? /,/g : /\./g, "").replace(",", ".");
  } else if (lang === "en" && /^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(/,(?=.*,)/g, "").replace(",", ".");
  } else if (lang === "es" && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// Fecha de hoy en hora local, AAAA-MM-DD.
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
