import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/prices/types";
import { bestPrice, rankTop, setSlugs } from "./logic";

const pt = (variant: string, price: number, currency = "USD", grader = "RAW"): PricePoint => ({
  cardId: "c", variant, grader, grade: null, date: "2026-10-07", price, currency, source: "tcgplayer",
});

describe("bestPrice", () => {
  it("la versión más cara, en la moneda pedida", () => {
    expect(bestPrice([pt("holo-unlimited", 945), pt("holo-shadowless-1st-edition", 9000), pt("x", 99999, "EUR")], "USD")).toEqual({
      variant: "holo-shadowless-1st-edition",
      price: 9000,
    });
  });
  it("sin precios válidos, null", () => {
    expect(bestPrice([pt("a", 0), pt("b", 5, "EUR"), pt("c", 50, "USD", "PSA")], "USD")).toBeNull();
  });
});

describe("rankTop", () => {
  it("de mayor a menor; a igual precio, por número", () => {
    const cards = [
      { localId: "10", price: 5 },
      { localId: "2", price: 50 },
      { localId: "1", price: 5 },
    ];
    expect(rankTop(cards, 2).map((c) => c.localId)).toEqual(["2", "1"]);
  });
});

describe("setSlugs", () => {
  it("nombre y código; sin código, el id; sin repetir", () => {
    const m = setSlugs([
      { key: "en-sv04.5", id: "sv04.5", name: "Paldean Fates", code: "PAF" },
      { key: "en-base1", id: "base1", name: "Base Set", code: null },
      { key: "en-cel25", id: "cel25", name: "Celebrations", code: "CEL" },
      { key: "en-cel25b", id: "cel25b", name: "Celebrations", code: "CEL" },
    ]);
    expect(m.get("en-sv04.5")).toBe("paldean-fates-paf");
    expect(m.get("en-base1")).toBe("base-set-base1");
    expect(m.get("en-cel25")).toBe("celebrations-cel");
    expect(m.get("en-cel25b")).toBe("celebrations-cel25b");
  });
});
