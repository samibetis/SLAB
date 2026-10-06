import { describe, expect, it } from "vitest";
import { backupFileName, makeBackup, parseBackup } from "./backup";

describe("copia de seguridad", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  it("ida y vuelta", () => {
    const b = makeBackup({ albums: [{ id: "a1" }], prices: [{ id: "p1" }] }, now);
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok && r.counts).toEqual({ albums: 1, holdings: 0, prices: 1 });
    expect(backupFileName(now)).toBe("slab-copia-2026-10-06.json");
  });
  it("rechaza lo que no es una copia de Slab o es de una versión futura", () => {
    expect(parseBackup("no json")).toEqual({ ok: false, error: "json" });
    expect(parseBackup(JSON.stringify({ hola: 1 }))).toEqual({ ok: false, error: "kind" });
    expect(parseBackup(JSON.stringify({ ...makeBackup({}), version: 99 }))).toEqual({ ok: false, error: "version" });
  });
  it("descarta registros sin id", () => {
    const r = parseBackup(JSON.stringify({ ...makeBackup({}), data: { albums: [{ id: "ok" }, { name: "x" }, null, { id: "" }] } }));
    expect(r.ok && r.counts.albums).toBe(1);
  });
});
