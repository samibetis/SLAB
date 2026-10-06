import { describe, expect, it } from "vitest";
import { makeManual, manualId, mergeManual, overrideRows } from "./manual";
import type { PricePoint } from "./types";

const pt = (grader: string, grade: number | null, date: string, price: number, source = "tcgplayer"): PricePoint => ({
  cardId: "c", variant: "holo", grader, grade, date, price, currency: "USD", source,
});

describe("makeManual", () => {
  it("id por carta, versión, nota y día; redondea y recorta la nota", () => {
    const m = makeManual({ cardId: "c", variant: "holo", grader: "psa", grade: 10, date: "2026-10-05", price: 120.456, currency: "USD" }, "  eBay vendido  ", new Date("2026-10-05T12:00:00Z"));
    expect(m).toMatchObject({ id: "c|holo|psa10|2026-10-05", grader: "PSA", price: 120.46, source: "manual", note: "eBay vendido" });
    expect(manualId("c", "holo", "raw", "2026-10-05")).toBe("c|holo|raw|2026-10-05");
  });
});

describe("mergeManual", () => {
  it("en las notas con precio propio mandan los del usuario; el resto, del servidor", () => {
    const server = [pt("RAW", null, "2026-10-05", 10), pt("PSA", 10, "2026-10-01", 999, "mock")];
    const manual = [pt("PSA", 10, "2026-10-04", 150, "manual")];
    expect(mergeManual(server, manual).map((p) => [p.grader, p.price])).toEqual([["RAW", 10], ["PSA", 150]]);
  });
  it("sin precios propios, lo del servidor tal cual", () => {
    const server = [pt("RAW", null, "2026-10-05", 10)];
    expect(mergeManual(server, [])).toBe(server);
  });
});

describe("overrideRows", () => {
  it("sustituye los meses de las claves con precios propios", () => {
    const server = [
      { t: "2026-09", p: { raw: 9, psa10: 100 } },
      { t: "2026-10", p: { raw: 10, psa10: 110 } },
    ];
    const own = [{ t: "2026-10", p: { raw: null, psa10: 150 } }];
    expect(overrideRows(server, own, ["raw", "psa10"])).toEqual([
      { t: "2026-09", p: { raw: 9, psa10: null } },
      { t: "2026-10", p: { raw: 10, psa10: 150 } },
    ]);
  });
  it("añade meses que el servidor no tenía", () => {
    expect(overrideRows([], [{ t: "2026-08", p: { psa9: 50 } }], ["psa9"])).toEqual([{ t: "2026-08", p: { psa9: 50 } }]);
  });
});
