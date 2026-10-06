import type { VariantOption } from "./types";

// Lógica pura de las versiones de una carta para los controles del visor:
//  - el tick "Reverse holo" cambia entre las versiones reverse y las que no lo son;
//  - el selector "Versión" elige entre las especiales (sello, 1ª edición, shadowless...).
// Ambos eligen una VariantOption, la misma que usan los precios.

// Dónde cae el brillo holográfico en el visor.
export type FoilMode = "none" | "all" | "window" | "reverse";

const isReverse = (o: VariantOption) => o.type === "reverse";

// Lo que distingue una versión sin contar si es holo/reverse: subtipo + sellos ("shadowless-1st-edition").
export const versionKey = (o: VariantOption) => [o.subtype, ...(o.stamps ?? [])].filter(Boolean).join("-");

export const hasReverse = (options: VariantOption[]) => options.some(isReverse);

// Versiones distintas (una opción de muestra por cada una), en el orden recibido.
export function versions(options: VariantOption[]): VariantOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const k = versionKey(o);
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// Activa o desactiva reverse manteniendo la versión si existe (mismo subtipo y sello).
export function withReverse(options: VariantOption[], current: VariantOption, on: boolean): VariantOption | undefined {
  const pool = options.filter((o) => isReverse(o) === on);
  return (
    pool.find((o) => versionKey(o) === versionKey(current)) ??
    pool.find((o) => !o.stamps?.length) ??
    pool[0]
  );
}

// Cambia de versión manteniendo si es reverse o no cuando se puede.
export function withVersion(options: VariantOption[], current: VariantOption, key: string): VariantOption | undefined {
  const pool = options.filter((o) => versionKey(o) === key);
  return pool.find((o) => isReverse(o) === isReverse(current)) ?? pool[0];
}

// Cartas de arte completo: el brillo cubre toda la carta aunque la versión sea "holo".
const FULL_ART = /ultra|secret|hyper|illustration|full art|vmax|vstar|rainbow|gold|amazing|shiny/i;

export function foilFor(option: VariantOption | undefined, rarity?: string): FoilMode {
  if (!option) return "all"; // sin datos de versión: como el prototipo
  if (option.type === "reverse") return "reverse";
  if (option.type === "normal") return "none";
  if (option.type === "holo") return rarity && FULL_ART.test(rarity) ? "all" : "window";
  return "all";
}

// Sello que se dibuja sobre la carta: el de 1ª edición, o el primero que tenga.
export function stampFor(option: VariantOption | undefined): string | null {
  if (!option?.stamps?.length) return null;
  return option.stamps.includes("1st-edition") ? "1st-edition" : option.stamps[0];
}

// Foto de la versión elegida, si es distinta de la principal. TCGplayer tiene un producto (y una foto)
// por versión impresa: la 1ª edición muestra su sello real, la shadowless no tiene sombra... Las reverse
// suelen compartir producto con la normal, así que ahí se queda la imagen principal y manda el brillo.
// Devuelve null cuando no hay foto propia: entonces se usa la imagen principal de la carta.
export function variantPhoto(options: VariantOption[], current: VariantOption | undefined): string | null {
  const id = current?.tcgplayerId;
  if (!id || id === options[0]?.tcgplayerId) return null;
  if (sharesProduct(options, current) && !current.stamps?.includes("1st-edition")) return null;
  return `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`;
}

// ¿Comparte producto de TCGplayer con otra versión? En Base Set, la 1ª edición y la shadowless son el
// mismo producto y su foto es la de la 1ª edición, con el sello: esa foto solo vale para la 1ª edición.
// La otra se queda con la imagen principal (y no se busca otra foto, que volvería a ser la misma).
export function sharesProduct(options: VariantOption[], current: VariantOption | undefined): boolean {
  const id = current?.tcgplayerId;
  return !!id && options.some((o) => o !== current && o.tcgplayerId === id);
}
