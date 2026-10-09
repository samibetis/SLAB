"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CardLanguage } from "@/lib/cards/types";
import type { RankedCard } from "@/lib/db/schema";
import { useI18n } from "@/components/I18nProvider";
import { bigImage, rankedCardHref } from "@/lib/rankings/logic";
import { CardLightbox, type LightboxItem } from "../CardLightbox";

// Brillo según la versión de la carta (la clave empieza por su tipo: "holo-…", "reverse-…", "normal-…").
// El ranking no guarda la rareza; las cartas de un top 10 suelen ser de arte completo, así que las holo
// brillan enteras (con "window" saldría un recuadro sobre el arte de las full art).
const foilOf = (variant: string) => (variant.startsWith("reverse") ? "reverse" : variant.startsWith("normal") ? "none" : "all");

// Un clic normal abre la carta encima de la página; con Ctrl/Cmd/Mayús o el botón central, el
// navegador hace lo de siempre (nueva pestaña). El enlace sigue siendo real para Google.
const plainClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// El top 10 de una colección: las tres primeras en grande y del 4 al 10 en lista.
export function RankingGallery({ top, lang, currency, setName }: { top: RankedCard[]; lang: CardLanguage; currency: string; setName: string }) {
  const { t: dict, f: fmt, path } = useI18n(); // `lang` (prop) es el idioma de las cartas, no el de la web
  const t = dict.rankings;
  const [open, setOpen] = useState<number | null>(null);

  const items: LightboxItem[] = useMemo(
    () =>
      top.map((c, i) => ({
        card: {
          id: c.id, name: c.name, number: c.number ?? c.localId, set: setName, language: lang,
          image: bigImage(c.image), foil: foilOf(c.variant),
        },
        title: `${i + 1}. ${c.name}`,
        subtitle: [c.number ?? c.localId, c.variantName].filter(Boolean).join(" · "),
        badge: fmt.money(c.price, currency),
        href: path(rankedCardHref(c, lang)),
      })),
    [top, lang, currency, setName, path, fmt],
  );

  const linkProps = (c: RankedCard, i: number) => ({
    href: path(rankedCardHref(c, lang)),
    onClick: (e: React.MouseEvent) => {
      if (!plainClick(e)) return;
      e.preventDefault();
      setOpen(i);
    },
  });

  return (
    <>
      {/* podio: las tres primeras, grandes */}
      <ol className="grid gap-4 sm:grid-cols-3" aria-label={t.setTitle(setName, null)}>
        {top.slice(0, 3).map((c, i) => (
          <li key={c.id}>
            <Link {...linkProps(c, i)} className="group flex h-full flex-col rounded-3xl bg-panel p-4 transition-transform duration-200 hover:-translate-y-1 active:scale-[0.99]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[40px] font-extrabold leading-none tabular-nums tracking-[-0.04em] [font-stretch:125%]" aria-label={t.rank(i + 1)}>
                  {i + 1}
                </span>
                <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.02em] [font-stretch:110%]">{fmt.money(c.price, currency)}</span>
              </div>
              <div className="mt-4 grid flex-1 place-items-center rounded-2xl bg-soft p-4">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imágenes de TCGdex / pokemontcg.io
                  <img
                    src={bigImage(c.image)!}
                    alt={`${c.name} ${c.number ?? c.localId}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="aspect-[63/88] w-full max-w-[170px] rounded-[10px] object-cover shadow-[0_18px_36px_-18px_rgb(var(--shadow-tint)/0.6)] transition-transform duration-300 group-hover:-rotate-1 group-hover:scale-[1.02] sm:max-w-[240px]"
                  />
                ) : (
                  <span className="aspect-[63/88] w-full max-w-[170px] rounded-[10px] bg-panel sm:max-w-[240px]" />
                )}
              </div>
              <p className="mt-4 text-[17px] font-bold leading-tight">{c.name}</p>
              <p className="mt-0.5 text-[13.5px] text-muted">{[c.number ?? c.localId, c.variantName].filter(Boolean).join(" · ")}</p>
            </Link>
          </li>
        ))}
      </ol>

      {/* del 4 al 10 */}
      {top.length > 3 && (
        <ol start={4} className="mt-6 flex flex-col gap-2">
          {top.slice(3).map((c, i) => (
            <li key={c.id}>
              <Link
                {...linkProps(c, i + 3)}
                className="group grid grid-cols-[40px_44px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-panel p-3 pr-4 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="text-center text-[22px] font-extrabold tabular-nums text-muted [font-stretch:115%]" aria-label={t.rank(i + 4)}>
                  {i + 4}
                </span>
                <span className="h-[61px] w-[44px] overflow-hidden rounded-[4px] bg-soft">
                  {c.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- miniaturas
                    <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15.5px] font-bold">{c.name}</span>
                  <span className="block truncate text-[13px] text-muted">{[c.number ?? c.localId, c.variantName].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[17px] font-extrabold tabular-nums">{fmt.money(c.price, currency)}</span>
                  <ArrowRightIcon size={15} className="text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <CardLightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
