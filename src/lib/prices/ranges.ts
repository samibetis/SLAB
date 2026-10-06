// Periodos del analizador y de la gráfica. `n` es el número de meses; Infinity = todo el histórico.
export const RANGES = [
  { k: "3M", n: 3 },
  { k: "6M", n: 6 },
  { k: "1A", n: 12 },
  { k: "3A", n: 36 },
  { k: "Todo", n: Infinity },
] as const;

export type RangeKey = (typeof RANGES)[number]["k"];
export const DEFAULT_RANGE: RangeKey = "1A";
