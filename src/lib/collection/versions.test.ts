import { describe, expect, it } from "vitest";
import type { VariantOption } from "@/lib/cards/types";
import type { Album, SetCard, Tracking } from "./types";
import { PRESETS, baseKey, cardStatus, markVersion, presetOf, setProgress, toggleVersion, toggleWhole, trackedVersions, versionKind } from "./versions";

const v = (key: string, type: string, extra: Partial<VariantOption> = {}): VariantOption => ({ key, type, ...extra });
const NORMAL = v("normal", "normal");
const REVERSE = v("reverse", "reverse");
const STAMP = v("normal-pokemon-together", "normal", { stamps: ["pokemon-together"] });

const card = (localId: string, variants?: VariantOption[]): SetCard => ({
  id: `en-sv04.5-${localId}`, externalId: `sv04.5-${localId}`, name: `Card ${localId}`, localId, language: "EN", image: null, variants,
});
const A = card("1", [NORMAL, REVERSE, STAMP]);
const B = card("2", [NORMAL, REVERSE]);
const C = card("3"); // sin datos de versiones (p. ej. japonesa)
const album = (tracking: Tracking = PRESETS.all, over: Partial<Album> = {}): Album => ({
  id: "a", name: "PAF", kind: "master", tracking, entries: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("tipos de versión", () => {
  it("base, reverse y especial", () => {
    expect(versionKind(NORMAL)).toBe("base");
    expect(versionKind(v("holo-unlimited", "holo", { subtype: "unlimited" }))).toBe("base");
    expect(versionKind(REVERSE)).toBe("reverse");
    expect(versionKind(STAMP)).toBe("special");
    expect(versionKind(v("holo-shadowless", "holo", { subtype: "shadowless" }))).toBe("special");
  });
  it("presets", () => {
    expect(presetOf(undefined)).toBe("cards");
    expect(presetOf(PRESETS.reverse)).toBe("reverse");
    expect(presetOf(PRESETS.all)).toBe("all");
  });
});

describe("qué versiones cuentan", () => {
  it("según el tipo de master set", () => {
    expect(trackedVersions(A, PRESETS.cards).map((o) => o.key)).toEqual(["normal"]);
    expect(trackedVersions(A, PRESETS.reverse).map((o) => o.key)).toEqual(["normal", "reverse"]);
    expect(trackedVersions(A, PRESETS.all).map((o) => o.key)).toEqual(["normal", "reverse", "normal-pokemon-together"]);
  });
  it("sin datos de versiones, una sola", () => {
    expect(trackedVersions(C, PRESETS.all).map((o) => o.key)).toEqual(["standard"]);
    expect(baseKey(C)).toBe("standard");
  });
});

describe("marcar versiones", () => {
  it("todas comparten bolsillo: el estado es por carta", () => {
    let a = album();
    a = toggleVersion(a, A, "reverse");
    a = toggleVersion(a, A, "normal-pokemon-together");
    const s = cardStatus(a, A);
    expect([...s.owned]).toEqual(["reverse", "normal-pokemon-together"]);
    expect(s).toMatchObject({ have: 2, any: true, complete: false });
    expect(a.entries[0]).not.toHaveProperty("variants"); // no se guardan las versiones en el álbum
    a = toggleVersion(a, A, "reverse");
    expect([...cardStatus(a, A).owned]).toEqual(["normal-pokemon-together"]);
  });
  it("las entradas antiguas sin versión cuentan como la base", () => {
    const a = album(PRESETS.reverse, { entries: [{ card: A, addedAt: "2026-01-01" }] });
    expect(cardStatus(a, A).have).toBe(1);
    expect(toggleVersion(a, A, "normal").entries).toEqual([]);
  });
  it("solo cartas: vale cualquier versión y un toque quita todas", () => {
    let a = album(PRESETS.cards);
    a = toggleVersion(a, A, "reverse");
    expect(cardStatus(a, A)).toMatchObject({ have: 1, complete: true });
    a = toggleWhole(a, A);
    expect(a.entries).toEqual([]);
    expect(toggleWhole(a, A).entries.map((e) => e.variant)).toEqual(["normal"]);
  });
  it("markVersion no desmarca", () => {
    const a = markVersion(album(), A, "reverse");
    expect(markVersion(a, A, "reverse")).toBe(a);
  });
});

describe("colecciones con sello en todas las cartas (30th Celebration)", () => {
  const ANNIV = v("normal-30th-anniversary", "normal", { stamps: ["30th-anniversary"] });
  const ANNIV_REV = v("reverse-30th-anniversary", "reverse", { stamps: ["30th-anniversary"] });
  const ANNIV_PROMO = v("normal-30th-anniversary-prerelease", "normal", { stamps: ["30th-anniversary", "prerelease"] });
  const X = card("1", [ANNIV, ANNIV_REV, ANNIV_PROMO]);
  it("la versión con el sello de la colección es la base; su reverse, reverse; otro sello, especial", () => {
    expect(baseKey(X)).toBe("normal-30th-anniversary");
    expect(trackedVersions(X, PRESETS.reverse).map((o) => o.key)).toEqual(["normal-30th-anniversary", "reverse-30th-anniversary"]);
    expect(trackedVersions(X, PRESETS.all)).toHaveLength(3);
  });
  it("lo marcado como 'standard' antes de tener las versiones cuenta como la base (caso real: 0 de 158)", () => {
    const solo = card("2", [ANNIV]);
    const a = album(PRESETS.all, { entries: [{ card: solo, variant: "standard", addedAt: "2026-10-01" }] });
    expect(setProgress(a, [solo])).toMatchObject({ owned: 1, total: 1, ratio: 1 });
    expect(toggleVersion(a, solo, "normal-30th-anniversary").entries).toEqual([]); // desmarcar la base la quita
  });
});

describe("progreso", () => {
  const set = [A, B, C];
  it("master set completo: cuenta versiones", () => {
    let a = album();
    a = toggleVersion(a, A, "normal");
    a = toggleVersion(a, A, "reverse");
    a = toggleVersion(a, B, "reverse");
    expect(setProgress(a, set)).toMatchObject({ owned: 3, total: 6, unit: "versions", cards: { owned: 2, total: 3 } });
  });
  it("el mismo álbum contado como solo cartas o con reverse", () => {
    let a = album();
    a = toggleVersion(a, A, "normal-pokemon-together");
    a = toggleVersion(a, B, "reverse");
    expect(setProgress({ ...a, tracking: PRESETS.cards }, set)).toMatchObject({ owned: 2, total: 3, unit: "cards" });
    expect(setProgress({ ...a, tracking: PRESETS.reverse }, set)).toMatchObject({ owned: 1, total: 5 });
  });
  it("colección vacía", () => expect(setProgress(album(), [])).toMatchObject({ owned: 0, total: 0, ratio: 0 }));
});
