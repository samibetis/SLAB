import { describe, expect, it } from "vitest";
import { versionOnlyLabel } from "./format";
import type { VariantOption } from "./types";
import { foilFor, hasReverse, sharesProduct, stampFor, variantPhoto, versionKey, versions, withReverse, withVersion } from "./variants";

const o = (type: string, subtype?: string, stamps?: string[]): VariantOption => ({
  key: [type, subtype, ...(stamps ?? [])].filter(Boolean).join("-"),
  type,
  ...(subtype ? { subtype } : {}),
  ...(stamps ? { stamps } : {}),
});

// Charizard de Base Set: cuatro versiones holo, ninguna reverse
const BASE = [o("holo", "unlimited"), o("holo", "shadowless", ["1st-edition"]), o("holo", "shadowless"), o("holo", "1999-2000-copyright")];
// Pikachu de 151: normal y reverse, y dos con sello
const PIKA = [o("normal"), o("reverse"), o("normal", undefined, ["pokemon-together"]), o("normal", undefined, ["snowflake"])];

describe("versiones y reverse", () => {
  it("versionKey no cuenta si es holo o reverse", () => {
    expect(versionKey(o("reverse"))).toBe("");
    expect(versionKey(o("holo", "shadowless", ["1st-edition"]))).toBe("shadowless-1st-edition");
  });
  it("versions: una por versión, sin repetir normal y reverse", () => {
    expect(versions(PIKA).map(versionKey)).toEqual(["", "pokemon-together", "snowflake"]);
    expect(versions(BASE)).toHaveLength(4);
  });
  it("hasReverse", () => {
    expect(hasReverse(PIKA)).toBe(true);
    expect(hasReverse(BASE)).toBe(false);
    expect(hasReverse([])).toBe(false);
  });
  it("withReverse: activa y desactiva en la misma versión", () => {
    expect(withReverse(PIKA, PIKA[0], true)!.key).toBe("reverse");
    expect(withReverse(PIKA, PIKA[1], false)!.key).toBe("normal");
  });
  it("withReverse: si la versión con sello no tiene reverse, usa la reverse sin sello", () => {
    expect(withReverse(PIKA, PIKA[2], true)!.key).toBe("reverse");
  });
  it("withReverse: si hay reverse con el mismo sello, la conserva", () => {
    const opts = [o("normal"), o("reverse"), o("normal", undefined, ["snowflake"]), o("reverse", undefined, ["snowflake"])];
    expect(withReverse(opts, opts[2], true)!.key).toBe("reverse-snowflake");
    expect(withReverse(opts, opts[3], false)!.key).toBe("normal-snowflake");
  });
  it("withVersion: cambia de versión conservando si es reverse", () => {
    const opts = [o("normal"), o("reverse"), o("normal", undefined, ["snowflake"]), o("reverse", undefined, ["snowflake"])];
    expect(withVersion(opts, opts[1], "snowflake")!.key).toBe("reverse-snowflake");
    expect(withVersion(opts, opts[0], "snowflake")!.key).toBe("normal-snowflake");
  });
  it("withVersion: si no hay esa combinación, la que exista", () => {
    expect(withVersion(PIKA, PIKA[1], "snowflake")!.key).toBe("normal-snowflake");
  });
  it("withVersion: versión inexistente", () => expect(withVersion(PIKA, PIKA[0], "nope")).toBeUndefined());
});

describe("foilFor: dónde cae el brillo", () => {
  it("normal: sin holo; reverse: fuera de la ventana", () => {
    expect(foilFor(o("normal"))).toBe("none");
    expect(foilFor(o("reverse"))).toBe("reverse");
  });
  it("holo normal: solo la ventana del arte", () => {
    expect(foilFor(o("holo"), "Rare Holo")).toBe("window");
    expect(foilFor(o("holo"), undefined)).toBe("window");
  });
  it("holo de arte completo: toda la carta", () => {
    expect(foilFor(o("holo"), "Special illustration rare")).toBe("all");
    expect(foilFor(o("holo"), "Hyper rare")).toBe("all");
    expect(foilFor(o("holo"), "Rare Holo VMAX")).toBe("all");
  });
  it("sin datos de versión: toda la carta, como el prototipo", () => expect(foilFor(undefined)).toBe("all"));
});

describe("stampFor y etiquetas", () => {
  it("el sello de 1ª edición tiene prioridad", () => {
    expect(stampFor(o("holo", "shadowless", ["1st-edition"]))).toBe("1st-edition");
    expect(stampFor(o("normal", undefined, ["snowflake", "1st-edition"]))).toBe("1st-edition");
  });
  it("otro sello: el primero; sin sello: null", () => {
    expect(stampFor(o("normal", undefined, ["snowflake"]))).toBe("snowflake");
    expect(stampFor(o("holo", "unlimited"))).toBeNull();
    expect(stampFor(undefined)).toBeNull();
  });
  it("versionOnlyLabel: sin el tipo, y 'Estándar' si no hay nada que distinga", () => {
    expect(versionOnlyLabel(o("holo", "shadowless", ["1st-edition"]))).toBe("Shadowless · 1ª edición");
    expect(versionOnlyLabel(o("normal", undefined, ["pokemon-together"]))).toBe("Pokemon together");
    expect(versionOnlyLabel(o("reverse"))).toBe("Estándar");
  });
});

describe("variantPhoto: foto de cada versión", () => {
  const unl = { ...o("holo", "unlimited"), tcgplayerId: 42382 };
  const first = { ...o("holo", "shadowless", ["1st-edition"]), tcgplayerId: 106999 };
  const shadow = { ...o("holo", "shadowless"), tcgplayerId: 106999 };
  const copy = o("holo", "1999-2000-copyright");
  const opts = [unl, first, shadow, copy];

  it("la versión principal usa la imagen principal de la carta", () => expect(variantPhoto(opts, unl)).toBeNull());
  it("una versión con producto propio usa su foto de TCGplayer", () => {
    expect(variantPhoto(opts, first)).toBe("https://tcgplayer-cdn.tcgplayer.com/product/106999_in_1000x1000.jpg");
  });
  it("sin producto de TCGplayer: imagen principal", () => expect(variantPhoto(opts, copy)).toBeNull());
  it("producto compartido (1ª edición y shadowless): la foto, con sello, solo para la 1ª edición", () => {
    expect(variantPhoto(opts, shadow)).toBeNull();
    expect(sharesProduct(opts, shadow)).toBe(true);
    expect(sharesProduct(opts, unl)).toBe(false);
  });
  it("reverse con el mismo producto que la normal: imagen principal", () => {
    const n = { ...o("normal"), tcgplayerId: 5 };
    const r = { ...o("reverse"), tcgplayerId: 5 };
    expect(variantPhoto([n, r], r)).toBeNull();
  });
  it("sin versión elegida: nada", () => expect(variantPhoto(opts, undefined)).toBeNull());
});
