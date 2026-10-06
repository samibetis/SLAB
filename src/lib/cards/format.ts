import { es } from "@/lib/i18n/es";
import type { CardSummary, VariantOption } from "./types";

export const langName = (l?: string) => (l && es.viewer.languages[l]) || l || "";

const isUnlimited = (e?: string) => !!e && /^unlimited$/i.test(e);

// "Base Set, 4/102, 1999, Rare" (misma línea que el prototipo)
export const metaLine = (c: CardSummary) =>
  [c.set, c.number, c.year, c.edition && !isUnlimited(c.edition) ? c.edition : null, c.rarity]
    .filter(Boolean)
    .join(", ");

// "pokemon-together" -> "Pokemon together" para sellos que no tienen traducción propia
const humanize = (s: string) => {
  const t = s.replace(/[-_]+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// "Holo · Shadowless · 1ª edición"
export function variantLabel(v: VariantOption): string {
  const t = es.variants;
  return [
    t.types[v.type] ?? humanize(v.type),
    v.subtype ? (t.subtypes[v.subtype] ?? humanize(v.subtype)) : null,
    ...(v.stamps ?? []).map((s) => t.stamps[s] ?? humanize(s)),
  ]
    .filter(Boolean)
    .join(" · ");
}

// Solo la versión, sin si es holo o reverse: "Shadowless · 1ª edición", "Snowflake"; sin sello ni subtipo, "Estándar".
export function versionOnlyLabel(v: VariantOption): string {
  const t = es.variants;
  const parts = [
    v.subtype ? (t.subtypes[v.subtype] ?? humanize(v.subtype)) : null,
    ...(v.stamps ?? []).map((s) => t.stamps[s] ?? humanize(s)),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : t.standard;
}

// Edición que se escribe en la etiqueta de la funda (en inglés, como las etiquetas reales).
export function variantEdition(v: VariantOption | undefined): string | undefined {
  if (!v) return undefined;
  if (v.stamps?.includes("1st-edition")) return "1st Edition";
  if (v.subtype === "shadowless") return "Shadowless";
  return undefined;
}
