import { describe, expect, it } from "vitest";
import { relabelVariant } from "@/lib/cards/format";
import { formatters } from "@/lib/prices/format";
import { DICTS, localePath, switchPath } from "./index";

describe("localePath", () => {
  it("el español va sin prefijo", () => {
    expect(localePath("es", "/colecciones")).toBe("/colecciones");
    expect(localePath("es", "/?card=x")).toBe("/?card=x");
  });
  it("el inglés lleva /en delante, también en la portada con ?card= o #sección", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/colecciones/pitch-black-pbl")).toBe("/en/colecciones/pitch-black-pbl");
    expect(localePath("en", "/?card=en-base1-4&lang=EN")).toBe("/en?card=en-base1-4&lang=EN");
    expect(localePath("en", "/#precios")).toBe("/en#precios");
  });
  it("no toca enlaces externos ni anclas sueltas", () => {
    expect(localePath("en", "https://paypal.me/x")).toBe("https://paypal.me/x");
    expect(localePath("en", "#precios")).toBe("#precios");
  });
});

describe("switchPath", () => {
  it("lleva a la misma página en el otro idioma", () => {
    expect(switchPath("/colecciones/pitch-black-pbl", "en")).toBe("/en/colecciones/pitch-black-pbl");
    expect(switchPath("/en/colecciones/pitch-black-pbl", "es")).toBe("/colecciones/pitch-black-pbl");
    expect(switchPath("/en?card=x#precios", "es")).toBe("/?card=x#precios");
    expect(switchPath("/en", "es")).toBe("/");
    expect(switchPath("/?card=x", "en")).toBe("/en?card=x");
  });
  it("no confunde /encuentros con el prefijo /en", () => {
    expect(switchPath("/encuentros", "es")).toBe("/encuentros");
  });
});

describe("relabelVariant", () => {
  it("traduce las etiquetas guardadas en cualquier idioma", () => {
    expect(relabelVariant("Holo · 1ª edición", DICTS.en)).toBe("Holo · 1st Edition");
    expect(relabelVariant("Holo · 1st Edition", DICTS.es)).toBe("Holo · 1ª edición");
    expect(relabelVariant("Estándar", DICTS.en)).toBe("Standard");
  });
  it("deja igual lo que no conoce", () => {
    expect(relabelVariant("Reverse holo · Pokemon together", DICTS.en)).toBe("Reverse holo · Pokemon together");
    expect(relabelVariant(undefined, DICTS.en)).toBeUndefined();
  });
});

describe("formatters", () => {
  const es = formatters("es");
  const en = formatters("en");
  it("fechas en cada idioma", () => {
    expect(es.dayLong("2026-10-04")).toBe("4 de octubre de 2026");
    expect(en.dayLong("2026-10-04")).toBe("October 4, 2026");
    expect(en.monthShort("2026-03")).toBe("Mar 26");
    expect(en.monthLong("2026-03")).toBe("March 2026");
  });
  it("precios en cada idioma", () => {
    expect(en.money(6.85, "USD")).toBe("$6.85");
    expect(en.money(1234, "USD")).toBe("$1,234");
    expect(es.money(6.85, "USD")).toMatch(/^6,85\sUS\$$/);
    expect(en.moneyCompact(1500, "EUR")).toBe("€1.5k");
    expect(en.pct(0.123)).toBe("+12%");
  });
});
