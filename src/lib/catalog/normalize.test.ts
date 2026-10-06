import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/types";
import { buildCardId, buildSlug, formatNumber, mapType, parseQuery, pickByNumber, rankCards, rankRefs, slugify, year } from "./normalize";
import type { CardRef } from "./types";

describe("ids y slugs", () => {
  it("construye el id propio en minúsculas", () => {
    expect(buildCardId("EN", "base1", "4")).toBe("en-base1-4");
    expect(buildCardId("JP", "SV2a", "006")).toBe("jp-sv2a-006");
  });
  it("slugify quita acentos y símbolos", () => {
    expect(slugify("Pokémon Card 151!")).toBe("pokemon-card-151");
  });
  it("el slug lleva el id; un nombre solo japonés usa solo el id", () => {
    expect(buildSlug("Charizard", "en-base1-4")).toBe("charizard-en-base1-4");
    expect(buildSlug("リザードン", "jp-sv2a-006")).toBe("jp-sv2a-006");
  });
});

describe("formato", () => {
  it("número con total oficial", () => {
    expect(formatNumber("4", 102)).toBe("4/102");
    expect(formatNumber("006", 165)).toBe("006/165");
    expect(formatNumber("CC008", 25)).toBe("CC008");
    expect(formatNumber("4", null)).toBe("4");
  });
  it("mapea tipos y cae en colorless", () => {
    expect(mapType("Fire")).toBe("fire");
    expect(mapType("Electric")).toBe("lightning");
    expect(mapType(undefined)).toBe("colorless");
    expect(mapType("Raro")).toBe("colorless");
  });
  it("año desde una fecha", () => {
    expect(year("1999-01-09")).toBe(1999);
    expect(year(undefined)).toBeUndefined();
  });
});

describe("parseQuery", () => {
  it("un nombre solo", () => {
    const q = parseQuery("Charizard");
    expect(q.number).toBeNull();
    expect(q.splits).toEqual([{ name: "Charizard", set: null }]);
  });
  it("reparte nombre y colección del más largo al más corto", () => {
    const q = parseQuery("Umbreon VMAX Evolving Skies");
    expect(q.splits.map((s) => [s.name, s.set])).toEqual([
      ["Umbreon VMAX Evolving Skies", null],
      ["Umbreon VMAX Evolving", "Skies"],
      ["Umbreon VMAX", "Evolving Skies"],
      ["Umbreon", "VMAX Evolving Skies"],
    ]);
  });
  it("extrae el número (también 4/102 y #4)", () => {
    expect(parseQuery("charizard 4/102").number).toBe("4");
    expect(parseQuery("charizard #4").number).toBe("4");
    expect(parseQuery("charizard base set 4").tokens).toEqual(["charizard", "base", "set"]);
  });
  it("un número solo se busca como nombre", () => {
    const q = parseQuery("151");
    expect(q.number).toBeNull();
    expect(q.tokens).toEqual(["151"]);
  });
  it("ignora palabras de versión", () => {
    expect(parseQuery("Lugia Neo Genesis 1st edition").tokens).toEqual(["Lugia", "Neo", "Genesis"]);
    expect(parseQuery("Umbreon VMAX alt art").tokens).toEqual(["Umbreon", "VMAX"]);
  });
  it("con numberAsWord el número es una palabra más", () => {
    const q = parseQuery("bulbasaur 151", { numberAsWord: true });
    expect(q.number).toBeNull();
    expect(q.tokens).toEqual(["bulbasaur", "151"]);
  });
});

const ref = (name: string, hasImage = true): CardRef => ({
  provider: "t", externalId: name, language: "EN", name, localId: "1", hasImage,
});
const card = (over: Partial<Card>): Card => ({ variantOptions: [],
  id: "x", slug: "x", name: "Charizard", setId: "s", localId: "1", language: "EN",
  imageUrl: "u", imageThumbUrl: "t", imageNeedsProxy: false, externalIds: {}, variants: null, ...over,
});

describe("ranking", () => {
  it("rankRefs: nombre exacto, luego empieza por, luego contiene; con imagen primero", () => {
    const q = parseQuery("charizard");
    const out = rankRefs([ref("Dark Charizard"), ref("Charizard ex"), ref("Charizard", false), ref("Charizard")], q);
    expect(out.map((r) => [r.name, r.hasImage])).toEqual([
      ["Charizard", true], ["Charizard", false], ["Charizard ex", true], ["Dark Charizard", true],
    ]);
  });
  it("rankCards: rareza alta primero y, a igualdad, la más antigua", () => {
    const q = parseQuery("charizard");
    const out = rankCards(
      [
        card({ id: "a", rarity: "Common", year: 1999 }),
        card({ id: "b", rarity: "Secret Rare", year: 2022 }),
        card({ id: "c", rarity: "Secret Rare", year: 2010 }),
        card({ id: "d", rarity: "Holo Rare", year: 2000 }),
      ],
      q,
    );
    expect(out.map((c) => c.id)).toEqual(["c", "b", "d", "a"]);
  });
  it("rankCards: las cartas sin imagen van detrás", () => {
    const out = rankCards([card({ id: "a", imageUrl: null, rarity: "Secret Rare" }), card({ id: "b", rarity: "Common" })], parseQuery("charizard"));
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("pickByNumber: el cero inicial importa", () => {
  const ids = (xs: { localId: string }[]) => xs.map((x) => x.localId);
  const c = (...l: string[]) => l.map((localId) => ({ localId }));

  it("con cero ('054') solo el número impreso exacto", () => {
    expect(ids(pickByNumber(c("054", "154", "254", "54"), "054"))).toEqual(["054"]);
  });
  it("sin cero ('54') compara el valor: acepta '054' y '54', no 154", () => {
    expect(ids(pickByNumber(c("054", "154", "254"), "54"))).toEqual(["054"]);
    expect(ids(pickByNumber(c("54", "154"), "54"))).toEqual(["54"]);
  });
  it("con cero pero la colección no usa ceros: cae al valor", () => {
    expect(ids(pickByNumber(c("54", "154"), "054"))).toEqual(["54"]);
  });
  it("japonés con tres cifras: '006' exacto y '6' por valor", () => {
    expect(ids(pickByNumber(c("006", "016", "060"), "006"))).toEqual(["006"]);
    expect(ids(pickByNumber(c("006", "016", "060"), "6"))).toEqual(["006"]);
  });
  it("los números con letras no cuentan: 'TG05' no es el 5", () => {
    expect(ids(pickByNumber(c("005", "05", "TG05", "GG05", "SWSH005"), "5"))).toEqual(["005", "05"]);
  });
  it("nada coincide: vacío", () => expect(pickByNumber(c("001", "002"), "054")).toEqual([]));
});
