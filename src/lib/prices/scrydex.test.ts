import { describe, expect, it } from "vitest";
import { scrydexPoints, scrydexVariant } from "./scrydex";

describe("scrydexVariant", () => {
  it("traduce nuestras versiones a las de Scrydex", () => {
    expect(scrydexVariant({ type: "normal" })).toBe("normal");
    expect(scrydexVariant({ type: "holo" })).toBe("holofoil");
    expect(scrydexVariant({ type: "reverse" })).toBe("reverseHolofoil");
    expect(scrydexVariant({ type: "holo", subtype: "unlimited" })).toBe("unlimitedHolofoil");
    expect(scrydexVariant({ type: "holo", subtype: "shadowless", stamps: ["1st-edition"] })).toBe("firstEditionHolofoil");
  });
  it("sin equivalencia conocida, null (no se pide)", () => {
    expect(scrydexVariant({ type: "normal", stamps: ["pokemon-together"] })).toBeNull();
    expect(scrydexVariant({ type: "holo", subtype: "1999-2000-copyright" })).toBeNull();
  });
});

describe("scrydexPoints", () => {
  it("solo precios gradeados de nuestra versión y de empresas conocidas", () => {
    const h = {
      data: [
        {
          date: "2026-03-24",
          prices: [
            { variant: "holofoil", type: "graded", company: "PSA", grade: "10", market: 1200.5, currency: "USD" },
            { variant: "holofoil", type: "graded", company: "bgs", grade: 9.5, low: 800, currency: "USD" },
            { variant: "holofoil", type: "raw", condition: "NM", market: 90 },
            { variant: "reverseHolofoil", type: "graded", company: "PSA", grade: "10", market: 50 },
            { variant: "holofoil", type: "graded", company: "ACE", grade: "10", market: 300 },
          ],
        },
      ],
    };
    expect(scrydexPoints("en-x-1", "holo", "holofoil", h)).toEqual([
      { cardId: "en-x-1", variant: "holo", grader: "PSA", grade: 10, date: "2026-03-24", price: 1200.5, currency: "USD", source: "scrydex" },
      { cardId: "en-x-1", variant: "holo", grader: "BGS", grade: 9.5, date: "2026-03-24", price: 800, currency: "USD", source: "scrydex" },
    ]);
  });
  it("respuesta vacía o rara: nada", () => {
    expect(scrydexPoints("c", "holo", "holofoil", {})).toEqual([]);
    expect(scrydexPoints("c", "holo", "holofoil", { data: [{ prices: [{ type: "graded" }] }] })).toEqual([]);
  });
});
