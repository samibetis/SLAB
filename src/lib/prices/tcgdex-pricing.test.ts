import { describe, expect, it } from "vitest";
import { rawPricePoints, type PricingDetail } from "./tcgdex-pricing";

const TODAY = "2026-10-05";
const tcg = (quotes: Record<string, number>) => ({
  unit: "USD", updated: "2026-10-04T09:52:57.756Z",
  ...Object.fromEntries(Object.entries(quotes).map(([k, v]) => [k, { marketPrice: v, midPrice: v * 1.2 }])),
});
const cm = (trend: number, trendHolo?: number) => ({ unit: "EUR", updated: "2026-10-04T09:52:39.911Z", trend, avg7: trend, "trend-holo": trendHolo ?? null });

describe("rawPricePoints", () => {
  it("carta moderna con reverse: un precio de TCGplayer por versión (respuesta real de Pineco, PAF)", () => {
    const pricing = { tcgplayer: tcg({ normal: 0.03, "reverse-holofoil": 0.16 }), cardmarket: cm(0.03, 0.1) };
    const d: PricingDetail = { pricing, variants_detailed: [{ type: "normal", pricing }, { type: "reverse", pricing }] };
    expect(rawPricePoints("en-sv04.5-001", d, TODAY)).toEqual([
      { cardId: "en-sv04.5-001", variant: "normal", grader: "RAW", grade: null, price: 0.03, currency: "USD", source: "tcgplayer", date: TODAY },
      { cardId: "en-sv04.5-001", variant: "reverse", grader: "RAW", grade: null, price: 0.16, currency: "USD", source: "tcgplayer", date: TODAY },
    ]);
  });

  it("Base Set: la 1ª edición y la shadowless sin precio propio no copian el de la unlimited", () => {
    const pricing = { tcgplayer: tcg({ holofoil: 944.98 }), cardmarket: cm(566.86) };
    const d: PricingDetail = {
      pricing,
      variants_detailed: [
        { type: "holo", subtype: "unlimited", pricing },
        { type: "holo", subtype: "shadowless", stamp: ["1st-edition"], pricing: null },
        { type: "holo", subtype: "shadowless", pricing: null },
      ],
    };
    const pts = rawPricePoints("en-base1-4", d, TODAY);
    expect(pts.map((p) => [p.variant, p.price])).toEqual([["holo-unlimited", 944.98]]);
  });

  it("la 1ª edición usa su propio apartado de TCGplayer cuando lo trae", () => {
    const pricing = { tcgplayer: tcg({ "1st-edition-holofoil": 5000 }) };
    const d: PricingDetail = { variants_detailed: [{ type: "holo", subtype: "shadowless", stamp: ["1st-edition"], pricing }] };
    expect(rawPricePoints("x", d, TODAY)[0]).toMatchObject({ variant: "holo-shadowless-1st-edition", price: 5000, currency: "USD" });
  });

  it("japonesa o promo sin TCGplayer: Cardmarket en euros", () => {
    const d: PricingDetail = { pricing: { cardmarket: cm(1.5) }, variants_detailed: [{ type: "holo" }] };
    expect(rawPricePoints("jp-sv2a-006", d, TODAY)[0]).toMatchObject({ variant: "holo", price: 1.5, currency: "EUR", source: "cardmarket" });
  });

  it("reverse en Cardmarket: los campos -holo", () => {
    const pricing = { cardmarket: cm(0.03, 0.1) };
    const d: PricingDetail = { variants_detailed: [{ type: "normal", pricing }, { type: "reverse", pricing }] };
    expect(rawPricePoints("x", d, TODAY).map((p) => p.price)).toEqual([0.03, 0.1]);
  });

  it("sin detalle de versiones: las de `variants`, o standard", () => {
    const pricing = { tcgplayer: tcg({ normal: 1, "reverse-holofoil": 2 }) };
    expect(rawPricePoints("x", { pricing, variants: { normal: true, reverse: true } }, TODAY).map((p) => p.variant)).toEqual(["normal", "reverse"]);
    expect(rawPricePoints("x", { pricing: { tcgplayer: tcg({ holofoil: 3 }) } }, TODAY)[0]).toMatchObject({ variant: "standard", price: 3 });
  });

  it("sin precios, nada; con precio, fechado el día en que se observa", () => {
    expect(rawPricePoints("x", { variants_detailed: [{ type: "holo" }] }, TODAY)).toEqual([]);
    const d: PricingDetail = { pricing: { tcgplayer: { holofoil: { marketPrice: 2 } } }, variants_detailed: [{ type: "holo" }] };
    expect(rawPricePoints("x", d, TODAY)[0].date).toBe(TODAY);
  });
});
