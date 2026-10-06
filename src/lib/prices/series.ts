import { GRADES, gradeKey } from "./grades";
import type { PricePoint, Row } from "./types";

// Puntos sueltos -> serie mensual. Los precios del mismo mes y grado se promedian
// (ventas de un mismo mes en un CSV, o varias instantáneas diarias).
export function pointsToSeries(points: PricePoint[], keys: string[] = GRADES.map((g) => g.key)): Row[] {
  const acc = new Map<string, Record<string, { sum: number; n: number }>>();
  for (const pt of points) {
    if (!(pt.price > 0) || !/^\d{4}-\d{2}/.test(pt.date)) continue;
    const k = gradeKey(pt.grader, pt.grade);
    if (!keys.includes(k)) continue;
    const t = pt.date.slice(0, 7);
    const m = acc.get(t) ?? {};
    const c = m[k] ?? (m[k] = { sum: 0, n: 0 });
    c.sum += pt.price;
    c.n++;
    acc.set(t, m);
  }
  return [...acc.keys()]
    .sort()
    .map((t) => {
      const m = acc.get(t)!;
      return { t, p: Object.fromEntries(keys.map((k) => [k, m[k] ? m[k].sum / m[k].n : null])) };
    });
}

// Último mes con dato (para "hasta marzo de 2026").
export const lastMonth = (rows: Row[]) => (rows.length ? rows[rows.length - 1].t : null);
