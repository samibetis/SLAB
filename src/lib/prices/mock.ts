import { GRADES } from "./grades";
import type { PricePoint, PriceProvider, PriceQuery } from "./types";

// Datos SINTÉTICOS para desarrollar la interfaz. No son precios de mercado y la UI los marca como tales.
// Son deterministas: la misma carta y versión dan siempre la misma curva.

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
// Generador pseudoaleatorio con semilla (mulberry32)
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Precio base de una copia raw según rareza y antigüedad.
function baseRaw(rarity: string | undefined, year: number | undefined, now: Date) {
  const r = rarity ?? "";
  const rare = /secret|hyper|rainbow|illustration|gold|ultra|vmax|vstar|amazing/i.test(r) ? 3 : /holo|double|rare/i.test(r) ? 2 : /uncommon/i.test(r) ? 0.4 : 0.3;
  const age = year ? Math.max(0, now.getFullYear() - year) : 5;
  return 2 * 4 ** rare * (1 + age * 0.35);
}

// Multiplicador por versión: una 1ª edición vale mucho más que una unlimited.
function variantFactor(variant: string) {
  let f = 1;
  if (variant.includes("1st-edition")) f *= 4;
  if (variant.includes("shadowless")) f *= 1.8;
  if (variant.includes("reverse")) f *= 1.3;
  if (variant.includes("copyright")) f *= 0.8;
  return f;
}

// Cuánto multiplica cada nota a una copia raw. PSA marca el mercado; un BGS 10 (etiqueta negra)
// es muy escaso y se paga por encima; CGC, SGC y TAG cotizan algo por debajo de PSA.
const GRADE_MULT: Record<string, number> = {
  raw: 1,
  psa7: 1.7, psa8: 2.5, psa9: 4.2, psa10: 11,
  "bgs8.5": 2.2, bgs9: 3.4, "bgs9.5": 7, bgs10: 24,
  "cgc8.5": 1.9, cgc9: 2.8, "cgc9.5": 5, cgc10: 8,
  "sgc8.5": 1.9, sgc9: 2.9, "sgc9.5": 5, sgc10: 8.5,
  "tag8.5": 1.8, tag9: 2.6, "tag9.5": 4.4, tag10: 7.5,
};

export function mockHistory(q: PriceQuery, now = new Date(), months = 36): PricePoint[] {
  const rand = rng(hash(`${q.card.id}|${q.variant}`));
  const base = baseRaw(q.card.rarity, q.card.year, now) * variantFactor(q.variant);
  const points: PricePoint[] = [];
  // Camino aleatorio con deriva, sacudidas mensuales y un par de saltos de mercado
  const jumps = new Map([[Math.floor(rand() * months), 0.35 * (rand() < 0.5 ? -1 : 1)], [Math.floor(rand() * months), 0.3]]);
  let level = base * (0.6 + rand() * 0.4);
  const drift = (rand() - 0.35) * 0.018;
  const shocks = GRADES.map(() => 0);
  for (let i = 0; i < months; i++) {
    level *= Math.exp(drift + (rand() - 0.5) * 0.12 + (jumps.get(i) ?? 0));
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    const date = d.toISOString().slice(0, 10);
    let rawPrice = 0;
    let prev = 0;
    let lastGrader = "";
    GRADES.forEach((g, gi) => {
      shocks[gi] = shocks[gi] * 0.6 + (rand() - 0.5) * (g.grade === 10 ? 0.2 : 0.1);
      // dentro de cada empresa, cada nota vale al menos un 5 % más que la anterior (y que la raw)
      if (g.grader !== lastGrader) {
        prev = g.grader === "RAW" ? 0 : rawPrice;
        lastGrader = g.grader;
      }
      const price = Math.max(level * (GRADE_MULT[g.key] ?? 1) * Math.exp(shocks[gi]), prev * 1.05);
      if (g.grader === "RAW") rawPrice = price;
      prev = price;
      points.push({
        cardId: q.card.id, variant: q.variant, grader: g.grader, grade: g.grade,
        date, price: Math.round(price * 100) / 100, currency: "USD", source: "mock",
      });
    });
  }
  return points;
}

export class MockProvider implements PriceProvider {
  readonly id = "mock";
  readonly label = "Datos de ejemplo";
  readonly synthetic = true;

  async getHistory(q: PriceQuery): Promise<PricePoint[]> {
    return mockHistory(q);
  }
}
