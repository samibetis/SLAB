import type { Metadata } from "next";
import { DEFAULT_LANG, DICTS, LANGS, isLang, localePath, type Dict, type Lang } from "./index";

// Idioma de una página a partir de su parámetro [lang] (para generateMetadata, que lo recibe en params).
export async function langOf(params: Promise<{ lang: string }>): Promise<{ lang: Lang; t: Dict }> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  return { lang: l, t: DICTS[l] };
}

// Metadatos comunes a cada página: su dirección canónica en este idioma y la gemela en el otro (hreflang),
// para que Google enseñe a cada uno la versión de su idioma. `path` es la dirección sin prefijo ("/colecciones").
export function localeMeta(lang: Lang, path: string): Pick<Metadata, "alternates"> & { openGraph: NonNullable<Metadata["openGraph"]> } {
  const languages: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l, localePath(l, path)]));
  languages["x-default"] = localePath(DEFAULT_LANG, path);
  return {
    alternates: { canonical: localePath(lang, path), languages },
    openGraph: { url: localePath(lang, path), locale: lang === "es" ? "es_ES" : "en_US" },
  };
}
