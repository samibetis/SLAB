"use client";

import { createContext, useContext, useMemo } from "react";
import { DICTS, localePath, type Lang } from "@/lib/i18n";
import { formatters } from "@/lib/prices/format";

// El idioma de la página para los componentes de navegador. El layout de [lang] lo pone una vez y cada
// componente pide con useI18n() los textos (t), los formatos de número y fecha (f) y las direcciones (path).
const LangContext = createContext<Lang>("es");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const lang = useContext(LangContext);
  return useMemo(
    () => ({ lang, t: DICTS[lang], f: formatters(lang), path: (p: string) => localePath(lang, p) }),
    [lang],
  );
}
