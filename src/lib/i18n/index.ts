import { en } from "./en";
import { es } from "./es";

// Idiomas de la web. El español va sin prefijo en la dirección (/colecciones); el inglés, con /en delante
// (/en/colecciones). El proxy (src/proxy.ts) reescribe las direcciones sin prefijo a /es por dentro.
export const LANGS = ["es", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "es";
export const LANG_COOKIE = "slab-lang"; // el idioma que eligió el usuario con el switch
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

// Locale de Intl para números y fechas
export const LOCALES: Record<Lang, string> = { es: "es-ES", en: "en-US" };

// El diccionario español con sus textos "abiertos" (string en vez del texto literal): así el inglés tiene
// que tener exactamente las mismas claves y funciones, pero puede decir otra cosa.
type Widen<T> = T extends string
  ? string
  : T extends number | boolean
    ? T
    : T extends (...args: infer A) => infer R
      ? (...args: A) => Widen<R>
      : T extends readonly (infer U)[]
        ? readonly Widen<U>[]
        : T extends object
          ? { [K in keyof T]: Widen<T[K]> }
          : T;
export type Dict = Widen<typeof es>;

export const DICTS: Record<Lang, Dict> = { es, en };
export const dict = (lang: Lang): Dict => DICTS[lang];

// Dirección dentro de la web en ese idioma: "/colecciones" -> "/en/colecciones", "/?card=x" -> "/en?card=x".
export function localePath(lang: Lang, path: string): string {
  if (lang === DEFAULT_LANG || !path.startsWith("/")) return path;
  if (path === "/") return `/${lang}`;
  if (path.startsWith("/?") || path.startsWith("/#")) return `/${lang}${path.slice(1)}`;
  return `/${lang}${path}`;
}

// La misma página en el otro idioma (para el switch y para hreflang). Quita el prefijo que tenga y pone el nuevo.
export function switchPath(path: string, to: Lang): string {
  const bare = path.replace(/^\/en(?=\/|$|\?|#)/, "") || "/";
  return localePath(to, bare.startsWith("/") ? bare : `/${bare}`);
}
