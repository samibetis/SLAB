import type { PricePoint } from "./types";

// Fuentes de precio raw real (TCGdex) que se guardan como instantáneas diarias.
export const RAW_SOURCES = ["tcgplayer", "cardmarket"] as const;
export const RAW_SOURCE_LABELS: Record<string, string> = { tcgplayer: "TCGplayer", cardmarket: "Cardmarket" };
export const isRawSource = (s: string) => (RAW_SOURCES as readonly string[]).includes(s);

// Las instantáneas raw reales de una carta y versión, todas en la moneda de la más reciente (si un día
// faltó TCGplayer y se guardó Cardmarket, no se mezclan dólares y euros en la misma línea).
export function realRaw(points: PricePoint[]): PricePoint[] {
  const raw = points.filter((p) => p.grader === "RAW" && isRawSource(p.source)).sort((a, b) => a.date.localeCompare(b.date));
  const currency = raw.at(-1)?.currency;
  return raw.filter((p) => p.currency === currency);
}

// Desarrollo: precio raw real + notas de ejemplo. Las notas sintéticas se escalan para que su raw
// coincida con el raw real de hoy; así los múltiplos (PSA 10 = 11 × raw...) se aplican a un precio de
// verdad. La raw sintética se descarta: la línea raw es solo la real.
export function anchorMock(real: PricePoint[], mock: PricePoint[]): PricePoint[] {
  const raw = realRaw(real);
  const last = raw.at(-1);
  const mockRaw = mock.filter((p) => p.grader === "RAW").sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!last) return mock; // sin precio real: todo sintético
  if (!mockRaw || !(mockRaw.price > 0)) return [...raw, ...mock.filter((p) => p.grader !== "RAW")];
  const k = last.price / mockRaw.price;
  const graded = mock
    .filter((p) => p.grader !== "RAW")
    .map((p) => ({ ...p, price: Math.max(0.01, Math.round(p.price * k * 100) / 100), currency: last.currency }));
  return [...raw, ...graded];
}
