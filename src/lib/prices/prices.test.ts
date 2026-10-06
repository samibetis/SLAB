import { describe, expect, it } from "vitest";
import { logTicks, niceStep, xLabelIndexes, yScale } from "./chart";
import { money, moneyCompact, monthLong, monthShort, num1, pct } from "./format";
import { GRADES, gradeKey, gradesFor } from "./grades";
import { mockHistory } from "./mock";
import { lastMonth, pointsToSeries } from "./series";
import type { PricePoint } from "./types";

const pt = (grader: string, grade: number | null, date: string, price: number): PricePoint => ({
  cardId: "c", variant: "v", grader, grade, date, price, currency: "USD", source: "t",
});

describe("grados como datos", () => {
  it("gradeKey: RAW y PSA", () => {
    expect(gradeKey("RAW", null)).toBe("raw");
    expect(gradeKey("PSA", 10)).toBe("psa10");
    expect(gradeKey("bgs", 9.5)).toBe("bgs9.5");
  });
  it("PSA: raw y PSA 7-10, en ese orden", () => {
    expect(gradesFor("PSA").map((g) => g.key)).toEqual(["raw", "psa7", "psa8", "psa9", "psa10"]);
  });
  it("las demás empresas: raw y 8.5-10", () => {
    expect(gradesFor("BGS").map((g) => g.key)).toEqual(["raw", "bgs8.5", "bgs9", "bgs9.5", "bgs10"]);
    expect(gradesFor("CGC").map((g) => g.label)).toEqual(["Raw", "CGC 8.5", "CGC 9", "CGC 9.5", "CGC 10"]);
  });
  it("la nota más alta de cada empresa usa el color del 10", () => {
    for (const id of ["PSA", "BGS", "CGC", "SGC", "TAG"] as const) expect(gradesFor(id).at(-1)!.color).toBe("--g-10");
  });
  it("GRADES reúne raw y las notas de todas las empresas, sin repetir", () => {
    const keys = GRADES.map((g) => g.key);
    expect(keys).toHaveLength(21);
    expect(new Set(keys).size).toBe(21);
    expect(keys).toContain("tag9.5");
  });
});

describe("pointsToSeries", () => {
  it("promedia por mes y grado, ordena y deja null donde no hay dato", () => {
    const s = pointsToSeries(
      [pt("PSA", 10, "2025-02-05", 900), pt("RAW", null, "2025-01-10", 10), pt("RAW", null, "2025-01-20", 30)],
      gradesFor("PSA").map((g) => g.key),
    );
    expect(s).toEqual([
      { t: "2025-01", p: { raw: 20, psa7: null, psa8: null, psa9: null, psa10: null } },
      { t: "2025-02", p: { raw: null, psa7: null, psa8: null, psa9: null, psa10: 900 } },
    ]);
  });
  it("ignora precios no positivos, fechas rotas y calificadoras desconocidas", () => {
    expect(pointsToSeries([pt("RAW", null, "2025-01-01", 0), pt("RAW", null, "xx", 5), pt("XYZ", 9.5, "2025-01-01", 5)])).toEqual([]);
  });
  it("las notas de otras empresas cuentan (BGS 9.5)", () => {
    expect(pointsToSeries([pt("BGS", 9.5, "2025-01-01", 500)])[0].p["bgs9.5"]).toBe(500);
  });
  it("lastMonth", () => {
    expect(lastMonth(pointsToSeries([pt("RAW", null, "2025-03-01", 1)]))).toBe("2025-03");
    expect(lastMonth([])).toBeNull();
  });
});

describe("formato", () => {
  it("pct", () => {
    expect(pct(0.5)).toBe("+50%");
    expect(pct(-0.1)).toBe("-10%");
    expect(pct(0.035)).toBe("+3,5%");
    expect(pct(null)).toBe("—");
  });
  it("num1", () => expect(num1(12.34)).toBe("12,3"));
  it("money: sin decimales por encima de 100 y — si no hay dato", () => {
    expect(money(1234.5, "USD")).toContain("1235");
    expect(money(null)).toBe("—");
    expect(money(Infinity)).toBe("—");
  });
  it("moneyCompact", () => {
    expect(moneyCompact(1500, "USD")).toBe("$1,5k");
    expect(moneyCompact(2_000_000, "USD")).toBe("$2M");
    expect(moneyCompact(50, "EUR")).toBe("50 €");
  });
  it("meses", () => {
    expect(monthShort("2026-03")).toBe("mar 26");
    expect(monthLong("2026-03")).toBe("marzo de 2026");
    expect(monthLong(null)).toBe("fecha sin indicar");
  });
});

describe("gráfica", () => {
  it("niceStep redondea a 1-2-2,5-5", () => {
    expect(niceStep(3)).toBe(5);
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1200)).toBe(2000);
  });
  it("logTicks: potencias de 10 si salen demasiadas", () => expect(logTicks(1, 1000)).toEqual([1, 10, 100, 1000]));
  it("logTicks: 1-2-5 en pocas décadas", () => expect(logTicks(10, 100)).toEqual([10, 20, 50, 100]));
  it("yScale logarítmica: más precio, más arriba (píxel menor)", () => {
    const { y, ticks } = yScale([10, 1000], true, 14, 200);
    expect(y(1000)).toBeLessThan(y(10));
    expect(ticks.length).toBeGreaterThan(1);
    expect(y(10)).toBeLessThanOrEqual(214);
    expect(y(1000)).toBeGreaterThanOrEqual(14);
  });
  it("yScale lineal arranca en 0 abajo del todo", () => {
    const { y, ticks } = yScale([10, 100], false, 14, 200);
    expect(ticks[0]).toBe(0);
    expect(y(0)).toBeCloseTo(214);
  });
  it("etiquetas del eje X: unas 6 y siempre la última", () => {
    expect(xLabelIndexes(13)).toEqual([0, 3, 6, 9, 12]);
    expect(xLabelIndexes(3)).toEqual([0, 1, 2]);
    expect(xLabelIndexes(37).at(-1)).toBe(36);
  });
});

describe("MockProvider (datos sintéticos)", () => {
  const card = { id: "en-base1-4", name: "Charizard", rarity: "Rare", year: 1999 };
  const now = new Date(Date.UTC(2026, 2, 15));
  const a = mockHistory({ card, variant: "holo-unlimited" }, now);

  it("36 meses x todos los grados, terminando en el mes actual", () => {
    expect(a).toHaveLength(36 * GRADES.length);
    expect(a.at(-1)!.date).toBe("2026-03-01");
    expect(a[0].date).toBe("2023-04-01");
  });
  it("es determinista: misma carta y versión, misma curva", () => {
    expect(mockHistory({ card, variant: "holo-unlimited" }, now)).toEqual(a);
    expect(mockHistory({ card, variant: "otra" }, now)).not.toEqual(a);
  });
  it("dentro de cada empresa, raw < nota baja < ... < nota alta, cada mes", () => {
    const s = pointsToSeries(a);
    for (const r of s)
      for (const id of ["PSA", "BGS", "CGC", "SGC", "TAG"] as const) {
        const v = gradesFor(id).map((g) => r.p[g.key]!);
        expect(v).toEqual([...v].sort((x, y) => x - y));
        expect(new Set(v).size).toBe(v.length);
      }
  });
  it("todo está marcado como mock y en dólares", () => {
    expect(a.every((p) => p.source === "mock" && p.currency === "USD" && p.price > 0)).toBe(true);
  });
  it("una 1ª edición vale bastante más que la unlimited", () => {
    const avg = (v: string) => {
      const s = pointsToSeries(mockHistory({ card, variant: v }, now));
      return s.reduce((t, r) => t + r.p.raw!, 0) / s.length;
    };
    expect(avg("holo-shadowless-1st-edition")).toBeGreaterThan(avg("holo-unlimited") * 2);
  });
});
