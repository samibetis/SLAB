import type { Card } from "@/lib/cards/types";

// Un precio en una fecha para una carta, una versión y un grado.
// `grader` es RAW | PSA | BGS | CGC...; `grade` es null en RAW. Los grados son datos, no columnas fijas.
export interface PricePoint {
  cardId: string;
  variant: string; // clave de VariantOption, o "standard"
  grader: string;
  grade: number | null;
  date: string; // AAAA-MM-DD
  price: number;
  currency: string;
  source: string; // id de la fuente: "csv", "mock", "pricecharting"...
}

export interface PriceQuery {
  card: Pick<Card, "id" | "name" | "rarity" | "year">;
  variant: string;
  signal?: AbortSignal;
}

// Un proveedor de precios. Implementaciones: CsvImportProvider, MockProvider y, pendiente de elegir
// fuente y presupuesto, un proveedor real de mercado (PriceCharting, Scrydex, JustTCG...).
export interface PriceProvider {
  readonly id: string;
  readonly label: string; // nombre que se enseña al usuario como fuente
  readonly synthetic: boolean; // true: datos inventados, solo para desarrollo
  getHistory(q: PriceQuery): Promise<PricePoint[]>;
}

// Serie mensual: precio medio de cada grado en cada mes (null si ese mes no hay dato).
export interface Row {
  t: string; // AAAA-MM
  p: Record<string, number | null>; // clave de grado -> precio
}

// De dónde salen los datos que se están enseñando.
export interface SeriesSource {
  id: string;
  label: string;
  synthetic: boolean; // true: hay datos inventados (en desarrollo, las notas)
  file?: string; // nombre del CSV importado
  raw?: { label: string; date: string; since: string }; // precio raw real (TCGdex): fuente, última y primera instantánea
}
