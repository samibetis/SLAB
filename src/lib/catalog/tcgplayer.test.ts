import { describe, expect, it } from "vitest";
import type { VariantOption } from "@/lib/cards/types";
import { pickVariantProduct, variantKeywords, type TcgProduct } from "./tcgplayer";

// Respuesta real del buscador de TCGplayer para "pikachu 025"
const PIKACHU: TcgProduct[] = [
  { productId: 712935, productName: "Pikachu - 025/128", setName: "ME: 30th Celebration", number: "025/128" },
  { productId: 517033, productName: "Pikachu - 025/165", setName: "SV: Scarlet & Violet 151", number: "025/165" },
  { productId: 650942, productName: "Pikachu - 025/165 (Holiday Calendar)", setName: "Miscellaneous Cards & Products", number: "025/165" },
  { productId: 559566, productName: "Pikachu - 025/165 (Pokemon Together)", setName: "Miscellaneous Cards & Products", number: "025/165" },
  { productId: 587938, productName: "Pikachu - 025/165 (Reverse Cosmos Holo) (Costco Exclusive)", setName: "Miscellaneous Cards & Products", number: "025/165" },
];
const card = { number: "025/165", localId: "025" };
const o = (type: string, extra: Partial<VariantOption> = {}): VariantOption => ({ key: type, type, ...extra });

describe("variantKeywords", () => {
  it("un grupo por sello, con sus nombres en TCGplayer", () => {
    expect(variantKeywords(o("normal", { stamps: ["snowflake"] }))).toEqual([["holiday calendar", "snowflake"]]);
  });
  it("shadowless cuenta; unlimited no", () => {
    expect(variantKeywords(o("holo", { subtype: "shadowless" }))).toEqual([["shadowless"]]);
    expect(variantKeywords(o("holo", { subtype: "unlimited" }))).toEqual([]);
  });
  it("sellos desconocidos: su nombre legible", () => {
    expect(variantKeywords(o("normal", { stamps: ["pokemon-center"] }))).toEqual([["pokemon center"]]);
  });
});

describe("pickVariantProduct", () => {
  it("sello Pokémon Together -> su producto", () => {
    expect(pickVariantProduct(PIKACHU, card, o("normal", { stamps: ["pokemon-together"] }))?.productId).toBe(559566);
  });
  it("sello Snowflake -> el del calendario navideño", () => {
    expect(pickVariantProduct(PIKACHU, card, o("normal", { stamps: ["snowflake"] }))?.productId).toBe(650942);
  });
  it("no confunde otra carta con el mismo nombre y otro número", () => {
    const other = { number: "025/128", localId: "025" };
    expect(pickVariantProduct(PIKACHU, other, o("normal", { stamps: ["pokemon-together"] }))).toBeNull();
  });
  it("versión sin sello: nada que buscar", () => {
    expect(pickVariantProduct(PIKACHU, card, o("normal"))).toBeNull();
  });
  it("sello que no tiene producto: null (se queda el sello dibujado)", () => {
    expect(pickVariantProduct(PIKACHU, card, o("normal", { stamps: ["staff"] }))).toBeNull();
  });
});
