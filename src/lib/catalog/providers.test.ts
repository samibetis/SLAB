import { beforeEach, describe, expect, it, vi } from "vitest";

// Se sustituye la red: los proveedores se prueban con respuestas ya grabadas de las APIs reales.
const getJson = vi.fn();
vi.mock("./http", () => ({ getJson: (...a: unknown[]) => getJson(...a), mapLimit: vi.fn() }));

import { PokemonTcgProvider } from "./pokemontcg";
import { parseQuery } from "./normalize";
import { TcgdexProvider } from "./tcgdex";

// llaves: si beforeEach devolviera la función, vitest la ejecutaría como limpieza (sin argumentos)
beforeEach(() => {
  getJson.mockReset();
});

describe("TcgdexProvider", () => {
  it("mapea el detalle de una carta a la forma normalizada", async () => {
    getJson.mockImplementation(async (url: string) =>
      url.includes("/sets/")
        ? { releaseDate: "1999-01-09" }
        : {
            id: "base1-4", localId: "4", name: "Charizard", rarity: "Rare", types: ["Fire"],
            image: "https://assets.tcgdex.net/en/base/base1/4",
            set: { id: "base1", name: "Base Set", cardCount: { official: 102 } },
            variants: { holo: true, firstEdition: true },
            variants_detailed: [{ type: "holo", subtype: "unlimited" }, { type: "holo", subtype: "shadowless", stamp: ["1st-edition"] }],
          },
    );
    const card = await new TcgdexProvider().getCard({
      provider: "tcgdex", externalId: "base1-4", language: "EN", name: "Charizard", localId: "4", hasImage: true,
    });
    expect(card).toMatchObject({
      id: "en-base1-4", slug: "charizard-en-base1-4", name: "Charizard", set: "Base Set", number: "4/102",
      year: 1999, language: "EN", rarity: "Rare", type: "fire", imageNeedsProxy: false,
      imageUrl: "https://assets.tcgdex.net/en/base/base1/4/high.webp",
      imageThumbUrl: "https://assets.tcgdex.net/en/base/base1/4/low.webp",
      externalIds: { tcgdex: "base1-4" },
      releaseDate: "1999-01-09",
    });
    expect(card?.variantOptions?.map((v) => v.key)).toEqual(["holo-unlimited", "holo-shadowless-1st-edition"]);
  });

  it("una carta japonesa sin imagen no inventa URL; la rareza 'None' desaparece", async () => {
    getJson.mockImplementation(async (url: string) =>
      url.includes("/sets/")
        ? { releaseDate: "2021-01-01" }
        : { id: "s8b-017", localId: "017", name: "リザードン", rarity: "None", set: { id: "s8b", name: "VMAXクライマックス", cardCount: { official: 184 } } },
    );
    const card = await new TcgdexProvider().getCard({
      provider: "tcgdex", externalId: "s8b-017", language: "JP", name: "リザードン", localId: "017", hasImage: false,
    });
    expect(card).toMatchObject({ id: "jp-s8b-017", number: "017/184", imageUrl: null, rarity: undefined, type: "colorless" });
  });

  it("search junta idiomas y repartos sin repetidos, y pide los más específicos primero", async () => {
    getJson.mockImplementation(async (url: string) => {
      if (url.includes("/ja/")) return [];
      return url.includes("set.name")
        ? [{ id: "swsh7-95", localId: "95", name: "Umbreon VMAX", image: "x" }]
        : [{ id: "swsh7-95", localId: "95", name: "Umbreon VMAX", image: "x" }, { id: "swsh7-94", localId: "94", name: "Umbreon V" }];
    });
    const refs = await new TcgdexProvider().search(parseQuery("umbreon vmax evolving skies"), { languages: ["EN", "JP"] });
    expect(refs.map((r) => r.externalId).sort()).toEqual(["swsh7-94", "swsh7-95"]);
    expect(new Set(refs.map((r) => r.externalId)).size).toBe(refs.length);
  });

  it("si todas las peticiones fallan, propaga el error", async () => {
    getJson.mockRejectedValue(new Error("caído"));
    await expect(new TcgdexProvider().search(parseQuery("charizard"), { languages: ["EN"] })).rejects.toThrow("caído");
  });

  it("si solo falla una, devuelve lo que hay", async () => {
    getJson.mockImplementation(async (url: string) => {
      if (url.includes("/ja/")) throw new Error("caído");
      return [{ id: "base1-4", localId: "4", name: "Charizard", image: "x" }];
    });
    const refs = await new TcgdexProvider().search(parseQuery("charizard"), { languages: ["EN", "JP"] });
    expect(refs.map((r) => r.externalId)).toEqual(["base1-4"]);
  });
});

describe("PokemonTcgProvider", () => {
  it("solo busca en inglés", async () => {
    expect(await new PokemonTcgProvider().search(parseQuery("charizard"), { languages: ["JP"] })).toEqual([]);
    expect(getJson).not.toHaveBeenCalled();
  });

  it("mapea la respuesta y marca la imagen como necesitada de proxy", async () => {
    getJson.mockResolvedValue({
      data: [{
        id: "base1-4", name: "Charizard", number: "4", rarity: "Rare Holo", types: ["Fire"],
        set: { id: "base1", name: "Base", printedTotal: 102, releaseDate: "1999/01/09" },
        images: { small: "https://images.pokemontcg.io/base1/4.png", large: "https://images.pokemontcg.io/base1/4_hires.png" },
      }],
    });
    const refs = await new PokemonTcgProvider().search(parseQuery("charizard base"), { languages: ["EN"] });
    expect(refs).toHaveLength(1);
    expect(refs[0].card).toMatchObject({
      id: "en-base1-4", number: "4/102", year: 1999, type: "fire", imageNeedsProxy: true, variantOptions: [], releaseDate: "1999-01-09",
      imageUrl: "https://images.pokemontcg.io/base1/4_hires.png", externalIds: { pokemontcg: "base1-4" },
    });
  });
});

describe("TcgdexProvider con códigos de colección", () => {
  const paf = { key: "en-sv04.5", id: "sv04.5", language: "EN" as const, name: "Paldean Fates", code: "PAF" };

  it("busca por id exacto de la colección, solo en su idioma", async () => {
    getJson.mockResolvedValue([{ id: "sv04.5-054", localId: "054", name: "Charizard ex", image: "x" }]);
    const refs = await new TcgdexProvider().search(parseQuery("charizard"), { languages: ["EN", "JP"], sets: [paf] });
    expect(getJson).toHaveBeenCalledTimes(1); // no se pregunta también en japonés
    const url = getJson.mock.calls[0][0] as string;
    expect(url).toContain("/en/cards?");
    expect(url).toContain("set.id=sv04.5");
    expect(url).toContain("name=charizard");
    expect(url).not.toContain("set.name");
    expect(refs.map((r) => r.externalId)).toEqual(["sv04.5-054"]);
  });

  it("listSet devuelve todas las cartas de la colección", async () => {
    getJson.mockResolvedValue({
      cards: [
        { id: "sv04.5-001", localId: "001", name: "Oddish", image: "x" },
        { id: "sv04.5-002", localId: "002", name: "Gloom" },
      ],
    });
    const refs = await new TcgdexProvider().listSet(paf);
    expect(getJson.mock.calls[0][0]).toContain("/en/sets/sv04.5");
    expect(refs.map((r) => [r.externalId, r.hasImage])).toEqual([["sv04.5-001", true], ["sv04.5-002", false]]);
  });
});
