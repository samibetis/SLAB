import { lang as rootLang } from "next/root-params";
import { formatters } from "@/lib/prices/format";
import { DEFAULT_LANG, DICTS, isLang, localePath } from "./index";

// El idioma de la página para los componentes de servidor: sale del segmento [lang] de la dirección
// (next/root-params), sin tener que pasarlo de componente en componente.
export async function getI18n() {
  const raw = await rootLang();
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  return { lang, t: DICTS[lang], f: formatters(lang), path: (p: string) => localePath(lang, p) };
}
