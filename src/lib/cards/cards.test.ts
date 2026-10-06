import { describe, expect, it } from "vitest";
import { variantOptions } from "@/lib/catalog/normalize";
import { backFor } from "./back";
import { metaLine, variantEdition, variantLabel } from "./format";

describe("reverso real según idioma y época", () => {
  it("sin carta o en inglés: internacional (igual desde 1999 hasta hoy)", () => {
    expect(backFor(null)).toBe("intl");
    expect(backFor({ language: "EN", releaseDate: "1999-01-09", year: 1999 })).toBe("intl");
    expect(backFor({ language: "EN", releaseDate: "2024-01-01", year: 2024 })).toBe("intl");
  });
  it("japonés anterior a julio de 2001: antiguo", () => {
    expect(backFor({ language: "JP", releaseDate: "1996-10-20", year: 1996 })).toBe("jp-old");
    expect(backFor({ language: "JP", releaseDate: "2001-06-30", year: 2001 })).toBe("jp-old");
  });
  it("japonés desde julio de 2001: moderno", () => {
    expect(backFor({ language: "JP", releaseDate: "2001-07-01", year: 2001 })).toBe("jp");
    expect(backFor({ language: "JP", releaseDate: "2023-06-16", year: 2023 })).toBe("jp");
  });
  it("japonés sin fecha exacta: decide el año (2001 cuenta como moderno)", () => {
    expect(backFor({ language: "JP", year: 1999 })).toBe("jp-old");
    expect(backFor({ language: "JP", year: 2001 })).toBe("jp");
    expect(backFor({ language: "JP" })).toBe("jp");
  });
});

describe("variantOptions", () => {
  it("Charizard de Base Set: cuatro versiones distintas", () => {
    const v = variantOptions([
      { type: "holo", subtype: "unlimited" },
      { type: "holo", subtype: "shadowless", stamp: ["1st-edition"] },
      { type: "holo", subtype: "shadowless" },
      { type: "holo", subtype: "1999-2000-copyright" },
    ]);
    expect(v.map((x) => x.key)).toEqual([
      "holo-unlimited", "holo-shadowless-1st-edition", "holo-shadowless", "holo-1999-2000-copyright",
    ]);
    expect(v[1]).toEqual({ key: "holo-shadowless-1st-edition", type: "holo", subtype: "shadowless", stamps: ["1st-edition"] });
  });
  it("guarda el producto de TCGplayer de cada versión", () => {
    const v = variantOptions([
      { type: "holo", subtype: "unlimited", thirdParty: { tcgplayer: 42382 } },
      { type: "holo", subtype: "1999-2000-copyright" },
    ]);
    expect(v[0].tcgplayerId).toBe(42382);
    expect("tcgplayerId" in v[1]).toBe(false);
  });
  it("quita las versiones repetidas", () => {
    const v = variantOptions([{ type: "reverse" }, { type: "normal" }, { type: "reverse" }]);
    expect(v.map((x) => x.key)).toEqual(["reverse", "normal"]);
  });
  it("sin detalle, usa las marcas generales", () => {
    expect(variantOptions(undefined, { normal: true, holo: false, reverse: true, firstEdition: true }).map((x) => x.key)).toEqual(["normal", "reverse"]);
  });
  it("sin nada, ninguna versión", () => expect(variantOptions(undefined)).toEqual([]));
});

describe("etiquetas de versión", () => {
  it("Holo · Shadowless · 1ª edición", () => {
    expect(variantLabel({ key: "k", type: "holo", subtype: "shadowless", stamps: ["1st-edition"] })).toBe("Holo · Shadowless · 1ª edición");
  });
  it("sellos sin traducción se legibilizan", () => {
    expect(variantLabel({ key: "k", type: "normal", stamps: ["pokemon-together"] })).toBe("Normal · Pokemon together");
  });
  it("la edición de la etiqueta de la funda", () => {
    expect(variantEdition({ key: "k", type: "holo", subtype: "shadowless", stamps: ["1st-edition"] })).toBe("1st Edition");
    expect(variantEdition({ key: "k", type: "holo", subtype: "shadowless" })).toBe("Shadowless");
    expect(variantEdition({ key: "k", type: "holo", subtype: "unlimited" })).toBeUndefined();
    expect(variantEdition(undefined)).toBeUndefined();
  });
});

describe("metaLine", () => {
  it("no escribe 'Unlimited'", () => {
    expect(metaLine({ name: "x", set: "Base Set", number: "4/102", year: 1999, edition: "Unlimited", rarity: "Rare" })).toBe("Base Set, 4/102, 1999, Rare");
  });
});
