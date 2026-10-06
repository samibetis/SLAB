import { describe, expect, it } from "vitest";
import { addCard, belongsTo, byNumber, cardImage, entryId, paginate } from "./logic";
import type { Album, AlbumCard } from "./types";

const c = (localId: string, set = "en-sv04.5"): AlbumCard => ({
  id: `${set}-${localId}`.toLowerCase(), externalId: `x-${localId}`, name: `Card ${localId}`, localId, language: "EN", image: "https://img/x",
});
const album = (over: Partial<Album> = {}): Album => ({
  id: "a", name: "PAF", kind: "master", set: { key: "en-sv04.5", id: "sv04.5", language: "EN", name: "Paldean Fates", code: "PAF" },
  entries: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("byNumber", () => {
  it("números en orden numérico, no alfabético", () => {
    expect(["10", "2", "054", "1"].map((l) => c(l)).sort(byNumber).map((x) => x.localId)).toEqual(["1", "2", "10", "054"]);
  });
  it("los que llevan letras van detrás", () => {
    expect(["TG05", "3", "TG01", "1"].map((l) => c(l)).sort(byNumber).map((x) => x.localId)).toEqual(["1", "3", "TG01", "TG05"]);
  });
});

describe("paginate", () => {
  it("páginas de 9 con huecos al final", () => {
    const pages = paginate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toEqual([10, 11, null, null, null, null, null, null, null]);
  });
  it("sin cartas, una página vacía", () => expect(paginate([])).toEqual([Array(9).fill(null)]));
});

describe("álbum libre", () => {
  const card = c("1");
  it("cada versión es su propia entrada; la misma versión no se duplica", () => {
    let a = album({ kind: "free", set: undefined });
    a = addCard(a, card, "normal");
    a = addCard(a, card, "reverse", new Date(), "Reverse holo");
    a = addCard(a, card, "reverse");
    expect(a.entries.map((e) => e.variant)).toEqual(["normal", "reverse"]);
    expect(new Set(a.entries.map(entryId)).size).toBe(2);
  });
});

describe("utilidades", () => {
  it("belongsTo: solo master sets de esa colección", () => {
    expect(belongsTo(album(), "en-sv04.5-054")).toBe(true);
    expect(belongsTo(album(), "en-sv04-054")).toBe(false); // sv04 no es sv04.5
    expect(belongsTo(album({ kind: "free", set: undefined }), "en-sv04.5-054")).toBe(false);
  });
  it("cardImage", () => {
    expect(cardImage({ image: "https://a/b" })).toBe("https://a/b/low.webp");
    expect(cardImage({ image: "https://a/b" }, "high")).toBe("https://a/b/high.webp");
    expect(cardImage({ image: null })).toBeNull();
  });
});

describe("toAlbumCard y enlaces", () => {
  it("guarda la imagen base de TCGdex y el id externo", async () => {
    const { toAlbumCard, cardHref } = await import("./logic");
    const a = toAlbumCard({
      id: "en-sv04.5-054", slug: "x", name: "Charizard ex", setId: "sv04.5", localId: "054", number: "054/091", set: "Paldean Fates",
      language: "EN", imageUrl: "https://assets.tcgdex.net/en/sv/sv04.5/054/high.webp", imageThumbUrl: "https://assets.tcgdex.net/en/sv/sv04.5/054/low.webp",
      imageNeedsProxy: false, externalIds: { tcgdex: "sv04.5-054" }, variants: null, variantOptions: [],
    });
    expect(a).toMatchObject({ image: "https://assets.tcgdex.net/en/sv/sv04.5/054", thumb: null, externalId: "sv04.5-054" });
    expect(cardHref(a)).toBe("/?card=en-sv04.5-054&ext=sv04.5-054&lang=EN");
  });
  it("imagen de otro proveedor: se guarda la miniatura completa", async () => {
    const { toAlbumCard, cardImage } = await import("./logic");
    const a = toAlbumCard({
      id: "en-base1-4", slug: "x", name: "Charizard", setId: "base1", localId: "4", language: "EN",
      imageUrl: "https://images.pokemontcg.io/base1/4_hires.png", imageThumbUrl: "https://images.pokemontcg.io/base1/4.png",
      imageNeedsProxy: true, externalIds: { pokemontcg: "base1-4" }, variants: null, variantOptions: [],
    });
    expect(cardImage(a)).toBe("https://images.pokemontcg.io/base1/4.png");
    expect(a.externalId).toBe("base1-4");
  });
});
