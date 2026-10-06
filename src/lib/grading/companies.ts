// Empresas de gradeo como datos: escala de notas, forma de la funda y código de color de la etiqueta.
// Las medidas son las reales aproximadas, en pulgadas (la carta mide 2,5 x 3,5). Las etiquetas se
// representan solo por su código de color y disposición: sin logotipos ni tipografías de terceros.

export type GraderId = "PSA" | "BGS" | "CGC" | "SGC" | "TAG";

// Tono de la etiqueta: BGS cambia de color según la nota; las demás usan oro para la "Pristine".
export type LabelTier = "standard" | "silver" | "gold" | "black";

export interface GradeOption {
  id: string; // "10", "9.5", "p10" (Pristine 10)
  value: number;
  word: string; // palabra impresa en la etiqueta
  tier: LabelTier;
}

export interface SlabSpec {
  w: number; // ancho
  h: number; // alto
  d: number; // grosor
  r: number; // radio de las esquinas
  labelH: number; // alto de la etiqueta
  insert: "clear" | "sleeve" | "black"; // interior: hueco transparente, funda interior (BGS) o marco negro (SGC)
}

export interface LabelStyle {
  layout: "frame" | "band" | "dark" | "metal"; // marco de color, banda superior, fondo oscuro, metalizada
  bg: string;
  ink: string; // texto principal
  sub: string; // texto secundario
  accent: string; // marco, banda o filete
}

export interface Grader {
  id: GraderId;
  name: string;
  slab: SlabSpec;
  label: LabelStyle;
  swatch: string; // color que la identifica en gráficas y repartos (su código de color de etiqueta)
  grades: GradeOption[]; // de mayor a menor
  priceGrades: number[]; // notas con precio propio en la sección de precios, de menor a mayor
  subgrades?: boolean; // BGS imprime 4 subnotas
}

const g = (id: string, value: number, word: string, tier: LabelTier = "standard"): GradeOption => ({ id, value, word, tier });

export const GRADERS: Record<GraderId, Grader> = {
  PSA: {
    id: "PSA",
    name: "PSA",
    swatch: "#c8202a",
    slab: { w: 3.25, h: 5.37, d: 0.24, r: 0.1, labelH: 0.95, insert: "clear" },
    label: { layout: "frame", bg: "#ffffff", ink: "#15171a", sub: "#41464d", accent: "#c8202a" },
    grades: [
      g("10", 10, "GEM MT"), g("9", 9, "MINT"), g("8", 8, "NM-MT"), g("7", 7, "NM"), g("6", 6, "EX-MT"),
      g("5", 5, "EX"), g("4", 4, "VG-EX"), g("3", 3, "VG"), g("2", 2, "GOOD"), g("1", 1, "PR"),
    ],
    priceGrades: [7, 8, 9, 10],
  },
  BGS: {
    id: "BGS",
    name: "BGS",
    swatch: "#8f969e",
    slab: { w: 3.56, h: 5.63, d: 0.4, r: 0.14, labelH: 1.08, insert: "sleeve" },
    label: { layout: "metal", bg: "#c9ced4", ink: "#15171a", sub: "#3a3f46", accent: "#8a9098" },
    grades: [
      g("10", 10, "PRISTINE", "black"), g("9.5", 9.5, "GEM MINT", "gold"), g("9", 9, "MINT", "silver"),
      g("8.5", 8.5, "NM-MT+", "silver"), g("8", 8, "NM-MT", "silver"), g("7.5", 7.5, "NEAR MINT+", "silver"),
      g("7", 7, "NEAR MINT", "silver"),
    ],
    priceGrades: [8.5, 9, 9.5, 10],
    subgrades: true,
  },
  CGC: {
    id: "CGC",
    name: "CGC",
    swatch: "#16698a",
    slab: { w: 3.38, h: 5.43, d: 0.3, r: 0.16, labelH: 1.0, insert: "clear" },
    label: { layout: "band", bg: "#ffffff", ink: "#15171a", sub: "#41464d", accent: "#16698a" },
    grades: [
      g("p10", 10, "PRISTINE", "gold"), g("10", 10, "GEM MINT"), g("9.5", 9.5, "MINT+"), g("9", 9, "MINT"),
      g("8.5", 8.5, "NM/MINT+"), g("8", 8, "NM/MINT"), g("7.5", 7.5, "NM+"), g("7", 7, "NM"),
    ],
    priceGrades: [8.5, 9, 9.5, 10],
  },
  SGC: {
    id: "SGC",
    name: "SGC",
    swatch: "#c9a24a",
    slab: { w: 3.35, h: 5.45, d: 0.28, r: 0.1, labelH: 0.95, insert: "black" },
    label: { layout: "dark", bg: "#16171a", ink: "#f2f2f0", sub: "#b9bcc2", accent: "#c9a24a" },
    grades: [
      g("p10", 10, "PRISTINE", "gold"), g("10", 10, "GEM MINT"), g("9.5", 9.5, "MINT+"), g("9", 9, "MINT"),
      g("8.5", 8.5, "NM-MT+"), g("8", 8, "NM-MT"), g("7", 7, "NM"),
    ],
    priceGrades: [8.5, 9, 9.5, 10],
  },
  TAG: {
    id: "TAG",
    name: "TAG",
    swatch: "#4a5058",
    slab: { w: 3.42, h: 5.5, d: 0.3, r: 0.18, labelH: 1.0, insert: "clear" },
    label: { layout: "frame", bg: "#202327", ink: "#f4f5f6", sub: "#aeb3ba", accent: "#e6e8eb" },
    grades: [
      g("p10", 10, "PRISTINE", "gold"), g("10", 10, "GEM MINT"), g("9.5", 9.5, "MINT+"), g("9", 9, "MINT"),
      g("8.5", 8.5, "NM-MT+"), g("8", 8, "NM-MT"), g("7", 7, "NM"),
    ],
    priceGrades: [8.5, 9, 9.5, 10],
  },
};

export const GRADER_IDS = Object.keys(GRADERS) as GraderId[];
export const DEFAULT_GRADER: GraderId = "PSA";

export const gradeOption = (grader: GraderId, id: string): GradeOption =>
  GRADERS[grader].grades.find((o) => o.id === id) ?? GRADERS[grader].grades[0];

// Al cambiar de empresa se conserva la nota si existe en la nueva escala; si no, la más alta.
export function carryGrade(to: GraderId, fromId: string): string {
  return GRADERS[to].grades.some((o) => o.id === fromId) ? fromId : GRADERS[to].grades[0].id;
}

// Cuatro subnotas de BGS (centrado, esquinas, bordes, superficie) coherentes con la nota final.
// Son ilustrativas: la nota real depende de cada carta.
export function bgsSubgrades(value: number): [number, number, number, number] {
  if (value >= 10) return [10, 10, 10, 10];
  if (value === 9.5) return [9.5, 9.5, 10, 9.5];
  if (value === 9) return [9, 9.5, 9, 9];
  return [value, value, value, value];
}

// Colores de la etiqueta según el tono de la nota (BGS plata/oro/negra; "Pristine" en oro).
export function labelColors(grader: Grader, opt: GradeOption): LabelStyle {
  const base = grader.label;
  switch (opt.tier) {
    case "black":
      return { ...base, bg: "#141416", ink: "#e3c169", sub: "#b9a26a", accent: "#e3c169" };
    case "gold":
      return grader.label.layout === "metal"
        ? { ...base, bg: "#d9b866", ink: "#1b1610", sub: "#4a3b1d", accent: "#a8842f" }
        : { ...base, accent: "#c9a24a" };
    default:
      return base;
  }
}
