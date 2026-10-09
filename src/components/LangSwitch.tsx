"use client";

import { useSyncExternalStore } from "react";
import { LANGS, LANG_COOKIE, localePath, switchPath } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

const noop = () => () => {};
const currentUrl = () => location.pathname + location.search + location.hash;

// Switch ES / EN de la cabecera. Lleva a la misma página en el otro idioma (con su ?card= y su #sección)
// y guarda la elección en una cookie, para que la portada no vuelva a decidir por el idioma del navegador.
export function LangSwitch() {
  const { lang, t } = useI18n();
  // la dirección real solo se conoce en el navegador (en el servidor, la portada del otro idioma)
  const here = useSyncExternalStore(noop, currentUrl, () => null);

  return (
    <div role="group" aria-label={t.lang.label} className="flex rounded-full bg-soft/80 p-0.5 text-[12px] font-bold tracking-wide">
      {LANGS.map((l) => (
        <a
          key={l}
          href={here ? switchPath(here, l) : localePath(l, "/")}
          hrefLang={l}
          lang={l}
          aria-label={t.lang.names[l]}
          aria-current={l === lang ? "true" : undefined}
          onClick={(e) => {
            document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            // por si la dirección ha cambiado desde que se pintó (#sección, ?card=)
            e.currentTarget.href = switchPath(currentUrl(), l);
          }}
          className="rounded-full px-2 py-1 text-muted transition-colors duration-200 hover:text-ink aria-[current=true]:bg-panel aria-[current=true]:text-ink aria-[current=true]:shadow-sm"
        >
          {t.lang.short[l]}
        </a>
      ))}
    </div>
  );
}
