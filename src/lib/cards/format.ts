import { es } from "@/lib/i18n/es";
import { DICTS, type Dict } from "@/lib/i18n";
import type { CardSummary, VariantOption } from "./types";

// Los textos salen del diccionario que se pase (el del idioma de la página); sin él, en español.
export const langName = (l?: string, d: Dict = es) => (l && d.viewer.languages[l]) || l || "";

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
export function variantLabel(v: VariantOption, d: Dict = es): string {
  const t = d.variants;
  return [
    t.types[v.type] ?? humanize(v.type),
    v.subtype ? (t.subtypes[v.subtype] ?? humanize(v.subtype)) : null,
    ...(v.stamps ?? []).map((s) => t.stamps[s] ?? humanize(s)),
  ]
    .filter(Boolean)
    .join(" · ");
}

// Solo la versión, sin si es holo o reverse: "Shadowless · 1ª edición", "Snowflake"; sin sello ni subtipo, "Estándar".
export function versionOnlyLabel(v: VariantOption, d: Dict = es): string {
  const t = d.variants;
  const parts = [
    v.subtype ? (t.subtypes[v.subtype] ?? humanize(v.subtype)) : null,
    ...(v.stamps ?? []).map((s) => t.stamps[s] ?? humanize(s)),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : t.standard;
}

// Etiqueta de versión guardada en un idioma (top 10, álbumes, portafolio) pasada al de la página, trozo a
// trozo: "Holo · 1ª edición" -> "Holo · 1st Edition". Lo que no reconoce (sellos sin traducción) se queda igual.
export function relabelVariant(name: string | undefined, d: Dict): string | undefined {
  if (!name) return name;
  const to = new Map<string, string>();
  for (const from of Object.values(DICTS)) {
    to.set(from.variants.standard, d.variants.standard);
    for (const g of ["types", "subtypes", "stamps"] as const)
      for (const [k, v] of Object.entries(from.variants[g])) to.set(v, d.variants[g][k] ?? v);
  }
  return name.split(" · ").map((p) => to.get(p) ?? p).join(" · ");
}

// Edición que se escribe en la etiqueta de la funda (en inglés, como las etiquetas reales).
export function variantEdition(v: VariantOption | undefined): string | undefined {
  if (!v) return undefined;
  if (v.stamps?.includes("1st-edition")) return "1st Edition";
  if (v.subtype === "shadowless") return "Shadowless";
  return undefined;
}
