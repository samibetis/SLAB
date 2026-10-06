import { describe, expect, it } from "vitest";
import { matchImages, normName, pickSet, type TheirCard } from "./fallback-images";

const img = (id: string) => ({ small: `https://img/${id}/small`, large: `https://img/${id}/large` });
const theirs = (id: string, name: string, number: string): TheirCard => ({ id, name, number, images: img(id) });
const ours = (localId: string, name: string) => ({ id: `en-30th-c-${localId}`, name, localId });

describe("normName", () => {
  it("ignora mayúsculas, guiones, símbolos y tildes", () => {
    expect(normName("Pikachu & Zekrom-GX")).toBe(normName("Pikachu & Zekrom GX"));
    expect(normName("Genesect-EX")).toBe("genesectex");
    expect(normName("Flabébé")).toBe("flabebe");
  });
});

describe("pickSet", () => {
  const cands = [
    { id: "me55", name: "30th Celebration", total: 161 },
    { id: "me55c", name: "30th Celebration: Classic Collection", total: 30 },
  ];
  it("elige la colección con el nombre más parecido (datos reales de la 30th)", () => {
    expect(pickSet({ name: "30th Classic Collection", total: 30 }, cands)?.id).toBe("me55c");
    expect(pickSet({ name: "30th Celebration", total: 161 }, cands)?.id).toBe("me55");
  });
  it("sin palabras en común, ninguna", () => {
    expect(pickSet({ name: "Paldean Fates" }, cands)).toBeNull();
  });
});

describe("matchImages", () => {
  it("empareja por nombre aunque la numeración sea otra (reediciones)", () => {
    const m = matchImages([ours("001", "Charizard"), ours("004", "Genesect EX")], [theirs("me55c-4", "Charizard", "4"), theirs("me55c-99x", "Genesect-EX", "99")]);
    expect(m.get("en-30th-c-001")?.pokemontcgId).toBe("me55c-4");
    expect(m.get("en-30th-c-004")?.pokemontcgId).toBe("me55c-99x");
  });
  it("nombres repetidos (las dos mitades de una LEGEND): por orden de número", () => {
    const m = matchImages(
      [ours("020", "Darkrai & Cresselia LEGEND"), ours("019", "Darkrai & Cresselia LEGEND")],
      [theirs("me55c-100", "Darkrai & Cresselia LEGEND", "100"), theirs("me55c-99", "Darkrai & Cresselia LEGEND", "99")],
    );
    expect(m.get("en-30th-c-019")?.pokemontcgId).toBe("me55c-99");
    expect(m.get("en-30th-c-020")?.pokemontcgId).toBe("me55c-100");
  });
  it("un nombre que empieza por el otro: Palkia / Palkia LV.X", () => {
    const m = matchImages([ours("022", "Palkia"), ours("021", "N")], [theirs("me55c-106", "Palkia LV.X", "106"), theirs("me55c-101", "N", "101")]);
    expect(m.get("en-30th-c-022")?.pokemontcgId).toBe("me55c-106");
  });
  it("si queda una de cada lado, se emparejan; las suyas sin imagen no cuentan", () => {
    const m = matchImages([ours("001", "Mew VMAX"), ours("002", "Lugia")], [theirs("x-1", "Mew VMAX", "1"), theirs("x-2", "Lugia (Holo)", "2"), { id: "x-3", name: "Lugia", number: "3" }]);
    expect(m.get("en-30th-c-002")?.pokemontcgId).toBe("x-2");
    expect(m.size).toBe(2);
  });
});
