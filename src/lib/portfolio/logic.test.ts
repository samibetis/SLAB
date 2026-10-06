import { describe, expect, it } from "vitest";
import type { Row } from "@/lib/prices/types";
import { addMonths, marketChange, monthRange, parseAmount, priceAt, priceKey, seriesRequests, summarize, timeline, type SeriesMap } from "./logic";
import type { Holding } from "./types";

const card = (id: string) => ({ id, externalId: id.replace(/^en-/, ""), name: id, localId: "1", language: "EN" as const, image: null });
const holding = (id: string, over: Partial<Holding> = {}): Holding => ({
  id,
  card: card("en-a-1"),
  variant: "standard",
  grader: "PSA",
  gradeId: "10",
  cost: 100,
  currency: "USD",
  bought: "2026-01-15",
  addedAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
  ...over,
});
const rows = (prices: [string, Record<string, number | null>][]): Row[] => prices.map(([t, p]) => ({ t, p }));

const A = rows([
  ["2025-12", { psa10: 80, psa9: 30 }],
  ["2026-01", { psa10: 100, psa9: 35 }],
  ["2026-02", { psa10: null, psa9: 40 }],
  ["2026-03", { psa10: 150, psa9: 45 }],
]);
const B = rows([
  ["2026-01", { "bgs9.5": 200 }],
  ["2026-02", { "bgs9.5": 180 }],
  ["2026-03", { "bgs9.5": 160 }],
]);
const series: SeriesMap = new Map([
  ["en-a-1|standard", A],
  ["en-b-1|standard", B],
]);

describe("meses", () => {
  it("suma y resta meses cruzando años", () => {
    expect(addMonths("2026-03", -12)).toBe("2025-03");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("lista los meses de un rango", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("priceKey", () => {
  it("usa la clave de la nota si tiene precio propio", () => {
    expect(priceKey({ grader: "PSA", gradeId: "10" })).toBe("psa10");
    expect(priceKey({ grader: "BGS", gradeId: "9.5" })).toBe("bgs9.5");
  });
  it("la Pristine 10 cotiza como el 10", () => {
    expect(priceKey({ grader: "CGC", gradeId: "p10" })).toBe("cgc10");
  });
  it("cualquier nota de la escala tiene clave (su precio lo puede poner el usuario)", () => {
    expect(priceKey({ grader: "PSA", gradeId: "6" })).toBe("psa6");
    expect(priceKey({ grader: "BGS", gradeId: "7" })).toBe("bgs7");
  });
  it("null si la nota no existe en la escala", () => {
    expect(priceKey({ grader: "PSA", gradeId: "9.5" })).toBeNull();
  });
});

describe("priceAt", () => {
  it("arrastra el último precio en los meses sin dato", () => {
    expect(priceAt(A, "psa10", "2026-02")).toBe(100);
    expect(priceAt(A, "psa10", "2026-03")).toBe(150);
  });
  it("null antes de que empiece la serie", () => {
    expect(priceAt(A, "psa10", "2025-06")).toBeNull();
  });
});

describe("summarize", () => {
  const hs = [
    holding("1"), // PSA 10 comprado por 100, vale 150
    holding("2", { card: card("en-b-1"), grader: "BGS", gradeId: "9.5", cost: 250 }), // vale 160
    holding("3", { grader: "PSA", gradeId: "6", cost: 40 }), // sin precio
  ];
  const s = summarize(hs, series);

  it("suma valor y coste solo de los slabs con precio", () => {
    expect(s.value).toBe(310);
    expect(s.cost).toBe(350);
    expect(s.pnl).toBe(-40);
    expect(s.pnlPct).toBeCloseTo(310 / 350 - 1);
    expect(s.unpriced).toEqual({ count: 1, cost: 40 });
    expect(s.count).toBe(3);
  });
  it("reparte el valor por empresa", () => {
    expect(s.byGrader.map((g) => [g.grader, g.count, g.value])).toEqual([
      ["BGS", 1, 160],
      ["PSA", 2, 150],
    ]);
    expect(s.byGrader[0].share).toBeCloseTo(160 / 310);
  });
  it("mejor y peor slab por rentabilidad", () => {
    expect(s.best?.h.id).toBe("1");
    expect(s.best?.pnlPct).toBeCloseTo(0.5);
    expect(s.worst?.h.id).toBe("2");
  });
  it("la mini gráfica arranca en el mes de compra", () => {
    expect(s.stats[0].spark).toEqual([100, 150]);
  });
});

describe("timeline", () => {
  it("cada slab cuenta desde su mes de compra", () => {
    const hs = [holding("1"), holding("2", { card: card("en-b-1"), grader: "BGS", gradeId: "9.5", cost: 250, bought: "2026-02-03" })];
    expect(timeline(hs, series)).toEqual([
      { t: "2026-01", value: 100, cost: 100, count: 1 },
      { t: "2026-02", value: 100 + 180, cost: 350, count: 2 },
      { t: "2026-03", value: 150 + 160, cost: 350, count: 2 },
    ]);
  });
  it("vacío si ningún slab tiene precio", () => {
    expect(timeline([holding("3", { gradeId: "6" })], series)).toEqual([]);
  });
});

describe("marketChange", () => {
  it("compara el precio de hoy con el de hace n meses, sin contar compras", () => {
    // Comprado en enero: el inicio es su mes de compra (100 -> 150)
    expect(marketChange([holding("1")], series, 12)).toBeCloseTo(0.5);
    // Último mes: febrero (100 arrastrado) -> marzo 150
    expect(marketChange([holding("1")], series, 1)).toBeCloseTo(0.5);
    const b = holding("2", { card: card("en-b-1"), grader: "BGS", gradeId: "9.5", bought: "2025-01-01" });
    expect(marketChange([b], series, 1)).toBeCloseTo(160 / 180 - 1);
  });
  it("todo el histórico parte del primer precio si la compra es anterior a la serie", () => {
    expect(marketChange([holding("1", { bought: "2024-05-01" })], series, Infinity)).toBeCloseTo(150 / 80 - 1);
  });
});

describe("seriesRequests", () => {
  it("una petición por carta y versión con las notas que usan sus slabs", () => {
    const req = seriesRequests([holding("1"), holding("2", { gradeId: "9" }), holding("3", { gradeId: "6" })]);
    expect(req).toEqual([{ id: "en-a-1", ext: "a-1", lang: "EN", variant: "standard", keys: ["psa10", "psa9", "psa6"] }]);
  });
});

describe("parseAmount", () => {
  it("entiende formato español e inglés", () => {
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("90,5")).toBe(90.5);
    expect(parseAmount("$ 90")).toBe(90);
    expect(parseAmount("1.500")).toBe(1500);
    expect(parseAmount("12.5")).toBe(12.5);
  });
  it("null si no hay número", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});
