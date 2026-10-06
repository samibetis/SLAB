import type { PricePoint } from "./types";

// Precios raw reales que TCGdex trae gratis en el detalle de cada carta: TCGplayer (USD, precio de
// mercado) y Cardmarket (EUR, tendencia). Solo el precio de hoy, sin histórico: el histórico se
// construye guardando una instantánea al día. Módulo puro: recibe el JSON y devuelve puntos.

interface TcgplayerQuote { marketPrice?: number | null; midPrice?: number | null }
export interface RawPricing {
  tcgplayer?: ({ unit?: string; updated?: string } & Record<string, TcgplayerQuote | string | undefined>) | null;
  cardmarket?: ({ unit?: string; updated?: string } & Record<string, number | string | null | undefined>) | null;
}
export interface PricingDetail {
  pricing?: RawPricing | null;
  variants?: Record<string, boolean> | null;
  variants_detailed?: { type?: string; subtype?: string; stamp?: string[]; pricing?: RawPricing | null }[] | null;
}

// Misma clave que VariantOption (catalog/normalize.ts): "holo-shadowless-1st-edition"
const keyOf = (type: string, subtype?: string, stamps?: string[]) => [type, subtype, ...(stamps ?? [])].filter(Boolean).join("-").toLowerCase();

const positive = (v: unknown): number | null => (typeof v === "number" && v > 0 ? Math.round(v * 100) / 100 : null);

// Qué apartado de TCGplayer corresponde a cada versión.
function tcgplayerKeys(type: string, stamps: string[]): string[] {
  if (stamps.includes("1st-edition")) return type === "normal" ? ["1st-edition-normal", "1st-edition"] : ["1st-edition-holofoil", "1st-edition"];
  if (type === "reverse") return ["reverse-holofoil"];
  if (type === "normal") return ["normal", "unlimited-normal", "unlimited"];
  return ["holofoil", "unlimited-holofoil"];
}

function fromTcgplayer(p: RawPricing["tcgplayer"], type: string, stamps: string[]): number | null {
  if (!p) return null;
  for (const k of tcgplayerKeys(type, stamps)) {
    const q = p[k];
    if (q && typeof q === "object") {
      const v = positive(q.marketPrice) ?? positive(q.midPrice);
      if (v) return v;
    }
  }
  return null;
}

// En Cardmarket los campos "-holo" son la versión reverse holo; los normales, la carta en sí.
function fromCardmarket(p: RawPricing["cardmarket"], type: string): number | null {
  if (!p) return null;
  return type === "reverse" ? (positive(p["trend-holo"]) ?? positive(p["avg7-holo"])) : (positive(p.trend) ?? positive(p.avg7));
}

// Un punto RAW por versión con precio. TCGplayer primero (USD); si no hay, Cardmarket (EUR).
// Las versiones especiales (sello, 1ª edición...) solo llevan precio si TCGdex se lo da a ellas: nunca
// se les copia el de la versión normal.
export function rawPricePoints(cardId: string, d: PricingDetail, today: string): PricePoint[] {
  const out: PricePoint[] = [];
  const seen = new Set<string>();
  const push = (variant: string, type: string, stamps: string[], pricing: RawPricing | null | undefined, special: boolean) => {
    if (seen.has(variant) || !pricing) return;
    const usd = fromTcgplayer(pricing.tcgplayer, type, stamps);
    // en especiales, Cardmarket da el precio del producto base: no sirve
    const eur = usd || special ? null : fromCardmarket(pricing.cardmarket, type);
    const price = usd ?? eur;
    if (!price) return;
    seen.add(variant);
    out.push({
      cardId, variant, grader: "RAW", grade: null, price,
      currency: usd ? "USD" : "EUR",
      source: usd ? "tcgplayer" : "cardmarket",
      // el día en que se observa el precio (TCGdex lo actualiza a diario); así el cron sabe qué
      // cartas tienen ya la instantánea de hoy
      date: today,
    });
  };

  if (d.variants_detailed?.length) {
    d.variants_detailed.forEach((v, i) => {
      if (!v.type) return;
      const stamps = v.stamp ?? [];
      const special = stamps.length > 0 || (!!v.subtype && v.subtype !== "unlimited");
      // la primera versión (la base) puede usar el precio general de la carta si no trae el suyo
      push(keyOf(v.type, v.subtype, stamps), v.type, stamps, v.pricing ?? (i === 0 && !special ? d.pricing : null), special);
    });
  } else {
    // sin detalle: las versiones que marca `variants`, o "standard" si no hay ninguna
    const types = ["normal", "holo", "reverse"].filter((t) => d.variants?.[t]);
    if (types.length) types.forEach((t) => push(t, t, [], d.pricing, false));
    else push("standard", "holo", [], d.pricing, false);
  }
  return out;
}
