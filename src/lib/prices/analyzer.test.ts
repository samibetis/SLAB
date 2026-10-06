import { describe, expect, it } from "vitest";
import { changeMatrix, details, facts, lastValue, slice, stats } from "./analyzer";
import { readingText } from "./reading";
import type { Row } from "./types";

// Serie de meses consecutivos desde 2020-01 con el precio de raw (y opcionalmente psa10)
const mk = (raw: (number | null)[], psa10?: (number | null)[]): Row[] =>
  raw.map((v, i) => ({
    t: `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    p: { raw: v, psa10: psa10 ? psa10[i] : null },
  }));

describe("stats", () => {
  const st = stats(mk([100, 120, 90, 180]), "raw")!;
  it("variación = último / primero - 1", () => expect(st.change).toBeCloseTo(0.8));
  it("mínimo, máximo, primero y último", () => {
    expect([st.min, st.max, st.first, st.last]).toEqual([90, 180, 100, 180]);
  });
  it("volatilidad = desviación típica de las variaciones mensuales", () => {
    // variaciones: +20 %, -25 %, +100 %  -> media 0,3167, desviación 0,5169
    expect(st.vol).toBeCloseTo(0.5169, 3);
  });
  it("peor caída desde un máximo previo", () => expect(st.dd).toBeCloseTo(-0.25)); // 120 -> 90
  it("sin caídas, la peor caída es 0", () => expect(stats(mk([1, 2, 3]), "raw")!.dd).toBe(0));
  it("la caída se mide desde el máximo anterior, no desde el inicio", () => {
    // sube a 200, cae a 100 (-50 %), vuelve a 150
    expect(stats(mk([100, 200, 100, 150]), "raw")!.dd).toBeCloseTo(-0.5);
  });
  it("necesita al menos dos precios", () => {
    expect(stats(mk([100]), "raw")).toBeNull();
    expect(stats(mk([100, null, null]), "raw")).toBeNull();
  });
  it("ignora los meses sin dato (compacta la serie)", () => {
    expect(stats(mk([100, null, 150]), "raw")!.change).toBeCloseTo(0.5);
  });
});

describe("slice y lastValue", () => {
  const series = mk(Array.from({ length: 40 }, (_, i) => i + 1));
  it("n meses = n+1 puntos", () => {
    expect(slice(series, "3M")).toHaveLength(4);
    expect(slice(series, "1A")).toHaveLength(13);
    expect(slice(series, "3A")).toHaveLength(37);
  });
  it("Todo devuelve la serie entera", () => expect(slice(series, "Todo")).toHaveLength(40));
  it("lastValue salta los meses sin dato del final", () => {
    expect(lastValue(mk([10, 20, null]), "raw")).toBe(20);
    expect(lastValue(mk([null, null]), "raw")).toBeNull();
  });
});

describe("changeMatrix", () => {
  it("— (null) si el histórico no cubre el periodo completo", () => {
    const m = changeMatrix(mk(Array.from({ length: 12 }, (_, i) => 100 + i)), ["raw"]);
    expect(m.raw["3M"]).not.toBeNull();
    expect(m.raw["6M"]).not.toBeNull();
    expect(m.raw["1A"]).toBeNull(); // 12 puntos no cubren 12 meses completos (hacen falta 13)
    expect(m.raw["3A"]).toBeNull();
    expect(m.raw["Todo"]).not.toBeNull();
  });
  it("con 13 meses, 1A ya cubre", () => {
    const m = changeMatrix(mk(Array.from({ length: 13 }, (_, i) => 100 + i)), ["raw"]);
    expect(m.raw["1A"]).toBeCloseTo(112 / 100 - 1);
    expect(m.raw["3A"]).toBeNull();
  });
});

describe("details y × raw", () => {
  const rows = mk([100, 100, 100], [1000, 1100, 1100]);
  const d = details(rows, ["raw", "psa10"]);
  it("× raw = precio actual del grado / precio actual raw", () => {
    expect(d.find((x) => x.key === "psa10")!.vsRaw).toBeCloseTo(11);
  });
  it("raw no tiene × raw", () => expect(d.find((x) => x.key === "raw")!.vsRaw).toBeNull());
  it("sin raw no hay × raw", () => {
    expect(details(mk([null, null], [10, 20]), ["raw", "psa10"]).find((x) => x.key === "psa10")!.vsRaw).toBeNull();
  });
});

describe("lectura automática", () => {
  const rows = mk([100, 100, 90], [1000, 1300, 1500]); // psa10 +50 %, raw -10 %
  const f = facts(details(rows, ["raw", "psa10"]))!;
  it("mejor, peor, más volátil y múltiplo PSA 10 / raw", () => {
    expect(f.best.key).toBe("psa10");
    expect(f.worst.key).toBe("raw");
    expect(f.mostVolatile.key).toBe("psa10");
    expect(f.top!.key).toBe("psa10");
    expect(f.top!.vsRaw).toBeCloseTo(1500 / 90);
  });
  it("las frases salen en español con los datos", () => {
    const text = readingText(f, "1 año", (k) => (k === "psa10" ? "PSA 10" : "Raw"));
    expect(text).toContain("En 1 año, PSA 10 es el grado con mejor evolución (+50%)");
    expect(text).toContain("y Raw el que peor (-10%)");
    expect(text).toContain("El más volátil es PSA 10");
    expect(text).toContain("Un PSA 10 cotiza a 16,7× una copia raw");
  });
  it("si mejor y peor son el mismo grado, no se repite", () => {
    const one = facts(details(mk([100, 150], undefined), ["raw"]))!;
    const text = readingText(one, "1 año", () => "Raw");
    expect(text).not.toContain("el que peor");
    expect(text).not.toContain("cotiza a"); // sin la nota máxima no hay margen de gradear
  });
  it("sin datos no hay lectura", () => expect(facts(details(mk([null, null]), ["raw"]))).toBeNull());
});

describe("lectura con otra empresa", () => {
  it("el margen usa la nota máxima de esa empresa", () => {
    const rows: Row[] = [
      { t: "2020-01", p: { raw: 100, bgs10: 2000 } },
      { t: "2020-02", p: { raw: 100, bgs10: 2400 } },
    ];
    const f = facts(details(rows, ["raw", "bgs10"]), "bgs10")!;
    expect(f.top).toEqual({ key: "bgs10", vsRaw: 24 });
    expect(readingText(f, "1 año", (k) => (k === "bgs10" ? "BGS 10" : "Raw"))).toContain("Un BGS 10 cotiza a 24× una copia raw");
  });
});
