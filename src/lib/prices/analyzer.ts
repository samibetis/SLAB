import { RANGES, type RangeKey } from "./ranges";
import type { Row } from "./types";

// Analizador de fluctuación. Funciones puras sobre la serie mensual de cada grado.
// Mismas definiciones que el prototipo.

export interface Stats {
  first: number;
  last: number;
  change: number; // último / primero - 1
  min: number;
  max: number;
  vol: number; // desviación típica de las variaciones de un mes a otro
  dd: number; // peor caída desde un máximo previo (<= 0)
}

const rangeN = (k: RangeKey) => RANGES.find((r) => r.k === k)!.n;

// Últimos n meses (n+1 puntos, porque la variación necesita el punto de partida).
export function slice(series: Row[], range: RangeKey): Row[] {
  const n = rangeN(range);
  return n === Infinity ? series : series.slice(-(n + 1));
}

// Último precio disponible de un grado en toda la serie.
export function lastValue(series: Row[], key: string): number | null {
  for (let i = series.length - 1; i >= 0; i--) if (series[i].p[key]) return series[i].p[key];
  return null;
}

export function stats(rows: Row[], key: string): Stats | null {
  const p = rows.map((r) => r.p[key]).filter((v): v is number => v != null && v > 0);
  if (p.length < 2) return null;
  const rets: number[] = [];
  let peak = p[0];
  let dd = 0;
  p.forEach((v, i) => {
    if (i) rets.push(v / p[i - 1] - 1);
    peak = Math.max(peak, v);
    dd = Math.min(dd, v / peak - 1);
  });
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
  return {
    first: p[0],
    last: p[p.length - 1],
    change: p[p.length - 1] / p[0] - 1,
    min: Math.min(...p),
    max: Math.max(...p),
    vol,
    dd,
  };
}

// Matriz grado x periodo. null si el histórico no cubre el periodo completo (se pinta "—").
export function changeMatrix(series: Row[], keys: string[]): Record<string, Record<RangeKey, number | null>> {
  const out: Record<string, Record<RangeKey, number | null>> = {};
  for (const key of keys) {
    const row = {} as Record<RangeKey, number | null>;
    for (const r of RANGES) {
      const covered = r.n === Infinity || series.length > r.n;
      row[r.k] = covered ? (stats(slice(series, r.k), key)?.change ?? null) : null;
    }
    out[key] = row;
  }
  return out;
}

export interface GradeDetail {
  key: string;
  st: Stats | null;
  vsRaw: number | null; // precio actual del grado / precio actual raw
}

export function details(rows: Row[], keys: string[]): GradeDetail[] {
  const all = keys.map((key) => ({ key, st: stats(rows, key) }));
  const raw = all.find((a) => a.key === "raw")?.st ?? null;
  return all.map(({ key, st }) => ({
    key,
    st,
    vsRaw: key !== "raw" && st && raw ? st.last / raw.last : null,
  }));
}

export interface Facts {
  best: { key: string; change: number };
  worst: { key: string; change: number };
  mostVolatile: { key: string; vol: number };
  top: { key: string; vsRaw: number } | null; // nota más alta de la empresa / raw: margen teórico de gradear
}

// Los datos de la "lectura automática"; la frase se arma en reading.ts.
// `topKey` es la nota más alta de la empresa que se está mirando ("psa10", "bgs10").
export function facts(d: GradeDetail[], topKey = "psa10"): Facts | null {
  const ok = d.filter((x): x is GradeDetail & { st: Stats } => !!x.st);
  if (!ok.length) return null;
  const best = ok.reduce((a, b) => (b.st.change > a.st.change ? b : a));
  const worst = ok.reduce((a, b) => (b.st.change < a.st.change ? b : a));
  const vol = ok.reduce((a, b) => (b.st.vol > a.st.vol ? b : a));
  return {
    best: { key: best.key, change: best.st.change },
    worst: { key: worst.key, change: worst.st.change },
    mostVolatile: { key: vol.key, vol: vol.st.vol },
    top: (() => {
      const t = d.find((x) => x.key === topKey);
      return t?.vsRaw != null ? { key: topKey, vsRaw: t.vsRaw } : null;
    })(),
  };
}
