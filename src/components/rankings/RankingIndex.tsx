"use client";

import { ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { normName } from "@/lib/catalog/fallback-images";
import { useI18n } from "@/components/I18nProvider";
import type { RankingSummary } from "@/lib/rankings/data";

// Índice de colecciones: buscador (nombre o código) y la lista agrupada por año, con su carta más cara.
// La lista llega entera del servidor (Google la ve completa); el filtro es solo en el navegador.
export function RankingIndex({ sets }: { sets: RankingSummary[] }) {
  const { t: dict, f: fmt, path } = useI18n();
  const t = dict.rankings;
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = normName(q);
    if (!n) return sets;
    return sets.filter((s) => normName(s.name).includes(n) || (s.code && normName(s.code).startsWith(n)));
  }, [q, sets]);
  const years = useMemo(() => {
    const m = new Map<string, RankingSummary[]>();
    for (const s of shown) {
      const y = s.year ?? "—";
      m.set(y, [...(m.get(y) ?? []), s]);
    }
    return [...m.entries()];
  }, [shown]);

  return (
    <div>
      <label className="sticky top-3 z-10 flex max-w-[560px] items-center gap-2 rounded-2xl border border-line bg-panel px-4 shadow-[0_8px_24px_-16px_rgb(var(--shadow-tint)/0.5)] transition-colors duration-200 focus-within:border-ink">
        <MagnifyingGlassIcon size={19} className="shrink-0 text-muted" aria-hidden />
        <span className="vh">{t.searchLabel}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          type="search"
          autoComplete="off"
          className="min-h-13 min-w-0 flex-1 bg-transparent py-3.5 text-[16px] outline-none placeholder:text-muted"
        />
        <span className="shrink-0 text-[13px] tabular-nums text-muted" aria-live="polite">{t.count(shown.length)}</span>
      </label>

      {shown.length === 0 && <p className="mt-10 text-[15px] text-muted">{t.noResults}</p>}

      <div className="mt-10 flex flex-col gap-12">
        {years.map(([year, list]) => (
          <section key={year} aria-labelledby={`y-${year}`} className="grid grid-cols-1 gap-4 md:grid-cols-[96px_minmax(0,1fr)] md:gap-8">
            <h2 id={`y-${year}`} className="text-[28px]! font-extrabold! tabular-nums text-muted md:sticky md:top-24 md:self-start">
              {year}
            </h2>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {list.map((s) => (
                <li key={s.key}>
                  <Link
                    href={path(`/colecciones/${s.slug}`)}
                    className="group flex min-h-[88px] items-center gap-4 rounded-2xl bg-panel p-3.5 pr-4 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                  >
                    <span className="grid h-[64px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-[4px] bg-soft">
                      {s.topImage && (
                        // eslint-disable-next-line @next/next/no-img-element -- miniaturas de TCGdex / pokemontcg.io
                        <img src={s.topImage} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-bold">{s.name}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {s.code && <span className="font-semibold text-ink">{s.code}</span>}
                        {s.code && " · "}
                        {s.topName && s.topPrice != null
                          ? `${t.topCard}: ${s.topName}, ${fmt.money(s.topPrice, s.currency ?? "USD")}`
                          : s.scannedAt
                            ? t.noPrices // ya barrida, pero ninguna carta tiene precio de mercado
                            : t.pending}
                      </span>
                    </span>
                    <ArrowRightIcon size={16} className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
