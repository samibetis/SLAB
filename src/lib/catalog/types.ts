import type { Card, CardLanguage } from "@/lib/cards/types";

// Búsqueda ya interpretada: "Umbreon VMAX Evolving Skies 215" -> nombre, colección y número.
export interface ParsedQuery {
  raw: string;
  tokens: string[];
  number: string | null; // "215", "4"
  // Cada candidato es una forma de repartir las palabras entre nombre y colección.
  splits: { name: string; set: string | null }[];
}

// Una colección conocida. `code` es el código corto que escribe la gente ("PAF").
export interface SetInfo {
  key: string; // "en-sv04.5"
  id: string; // id en TCGdex
  language: CardLanguage;
  name: string;
  code: string | null;
  releaseDate?: string;
}

export interface SearchOptions {
  languages: CardLanguage[];
  sets?: SetInfo[]; // si se indica, la búsqueda se limita a estas colecciones
  signal?: AbortSignal;
}

// Referencia ligera (lo que da un listado). Pedir el detalle de cada una es lo caro.
export interface CardRef {
  provider: string;
  externalId: string;
  language: CardLanguage;
  name: string;
  localId: string;
  hasImage: boolean;
  image?: string; // imagen base de TCGdex, cuando el listado la trae (sin "/low.webp")
  card?: Card; // si el proveedor ya devuelve la carta completa en el listado
}

// Un proveedor de catálogo. Hoy TCGdex (principal) y pokemontcg.io (respaldo en inglés).
export interface CatalogProvider {
  readonly id: string;
  readonly languages: CardLanguage[];
  search(query: ParsedQuery, opts: SearchOptions): Promise<CardRef[]>;
  getCard(ref: CardRef, signal?: AbortSignal): Promise<Card | null>;
  listSet?(set: SetInfo, signal?: AbortSignal): Promise<CardRef[]>; // todas las cartas de una colección
}
