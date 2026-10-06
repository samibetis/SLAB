import { describe, expect, it } from "vitest";
import { findSetToken, looksLikeCode, matchSets } from "./sets";
import type { SetInfo } from "./types";

const set = (id: string, name: string, code: string | null, language: "EN" | "JP" = "EN"): SetInfo => ({
  key: `${language}-${id}`.toLowerCase(), id, language, name, code,
});

const ALL = [
  set("sv04.5", "Paldean Fates", "PAF"),
  set("sv03.5", "151", "MEW"),
  set("base1", "Base Set", "BS"),
  set("swsh7", "Evolving Skies", "EVS"),
  set("SV4a", "レイジングサーフ", "SV4a", "JP"),
  set("SV2a", "ポケモンカード151", "SV2a", "JP"),
];

describe("looksLikeCode", () => {
  it("3 o más caracteres: vale en cualquier caja", () => {
    expect(looksLikeCode("PAF")).toBe(true);
    expect(looksLikeCode("paf")).toBe(true);
    expect(looksLikeCode("sv04.5")).toBe(true);
    expect(looksLikeCode("SV4a")).toBe(true);
  });
  it("2 caracteres: solo en mayúsculas (en minúsculas suele ser parte de un nombre)", () => {
    expect(looksLikeCode("BS")).toBe(true);
    expect(looksLikeCode("ex")).toBe(false);
    expect(looksLikeCode("gx")).toBe(false);
  });
  it("un solo carácter, solo números o símbolos: no", () => {
    expect(looksLikeCode("V")).toBe(false);
    expect(looksLikeCode("151")).toBe(false);
    expect(looksLikeCode("54")).toBe(false);
    expect(looksLikeCode("¡hola!")).toBe(false);
  });
});

describe("matchSets", () => {
  it("por código, sin importar mayúsculas", () => {
    expect(matchSets(ALL, "PAF").map((s) => s.id)).toEqual(["sv04.5"]);
    expect(matchSets(ALL, "paf").map((s) => s.id)).toEqual(["sv04.5"]);
  });
  it("por id de colección, también el japonés", () => {
    expect(matchSets(ALL, "sv04.5").map((s) => s.id)).toEqual(["sv04.5"]);
    expect(matchSets(ALL, "sv4a").map((s) => s.id)).toEqual(["SV4a"]);
  });
  it("ignora guiones y símbolos: SV-04.5 = sv04.5", () => {
    expect(matchSets(ALL, "SV-04.5").map((s) => s.id)).toEqual(["sv04.5"]);
  });
  it("devuelve todas las colecciones que comparten código", () => {
    const dup = [...ALL, set("paf-promo", "PAF Promos", "PAF")];
    expect(matchSets(dup, "PAF").map((s) => s.id)).toEqual(["sv04.5", "paf-promo"]);
  });
  it("código desconocido o vacío: nada", () => {
    expect(matchSets(ALL, "ZZZ")).toEqual([]);
    expect(matchSets(ALL, "")).toEqual([]);
  });
});

describe("findSetToken", () => {
  it("encuentra el código dentro de la consulta", () => {
    const hit = findSetToken(["charizard", "PAF"], ALL)!;
    expect(hit.index).toBe(1);
    expect(hit.sets[0].name).toBe("Paldean Fates");
  });
  it("también al principio o solo", () => {
    expect(findSetToken(["PAF", "charizard"], ALL)!.index).toBe(0);
    expect(findSetToken(["PAF"], ALL)!.index).toBe(0);
  });
  it("si hay varias coincidencias, la última palabra", () => {
    expect(findSetToken(["BS", "PAF"], ALL)!.token).toBe("PAF");
  });
  it("sin código, nada: las palabras normales no se confunden", () => {
    expect(findSetToken(["charizard", "base", "set"], ALL)).toBeNull();
    expect(findSetToken(["umbreon", "ex"], ALL)).toBeNull(); // "ex" en minúsculas no cuenta
  });
});
