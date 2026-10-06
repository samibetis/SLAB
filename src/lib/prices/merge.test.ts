import { describe, expect, it } from "vitest";
import { anchorMock, realRaw } from "./merge";
import type { PricePoint } from "./types";

const pt = (date: string, price: number, over: Partial<PricePoint> = {}): PricePoint => ({
  cardId: "c", variant: "holo", grader: "RAW", grade: null, date, price, currency: "USD", source: "tcgplayer", ...over,
});

describe("realRaw", () => {
  it("solo raw de TCGdex, en orden y en la moneda de la más reciente", () => {
    const pts = [
      pt("2026-10-03", 10),
      pt("2026-10-01", 9.5, { currency: "EUR", source: "cardmarket" }),
      pt("2026-10-02", 9),
      pt("2026-10-02", 50, { grader: "PSA", grade: 10, source: "mock" }),
    ];
    expect(realRaw(pts).map((p) => [p.date, p.price])).toEqual([["2026-10-02", 9], ["2026-10-03", 10]]);
  });
});

describe("anchorMock", () => {
  const mock = [
    pt("2026-09-01", 4, { source: "mock" }),
    pt("2026-10-01", 5, { source: "mock" }),
    pt("2026-09-01", 40, { grader: "PSA", grade: 10, source: "mock" }),
    pt("2026-10-01", 55, { grader: "PSA", grade: 10, source: "mock" }),
  ];
  it("escala las notas sintéticas al raw real y descarta la raw sintética", () => {
    const out = anchorMock([pt("2026-10-04", 20, { currency: "EUR", source: "cardmarket" })], mock);
    expect(out.filter((p) => p.grader === "RAW")).toEqual([pt("2026-10-04", 20, { currency: "EUR", source: "cardmarket" })]);
    // raw sintética de octubre 5 -> real 20: factor 4
    expect(out.filter((p) => p.grader === "PSA").map((p) => [p.price, p.currency])).toEqual([[160, "EUR"], [220, "EUR"]]);
  });
  it("sin precio real, todo sintético tal cual", () => {
    expect(anchorMock([], mock)).toBe(mock);
  });
});
