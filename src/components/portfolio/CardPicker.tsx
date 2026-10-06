"use client";

import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { metaLine } from "@/lib/cards/format";
import type { Card } from "@/lib/cards/types";
import { es } from "@/lib/i18n/es";

// Buscador compacto para elegir la carta de un slab dentro del portafolio (mismo endpoint que el de la
// portada, sin tocar la carta del visor).
export function CardPicker({ onPick }: { onPick: (c: Card) => void }) {
  const t = es.portfolio;
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    ctl.current?.abort();
  }, []);

  function onQuery(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    ctl.current?.abort();
    if (v.trim().length < 2) {
      setCards(null);
      setState("idle");
      return;
    }
    timer.current = setTimeout(async () => {
      const c = (ctl.current = new AbortController());
      setState("loading");
      try {
        const r = await fetch(`/api/cards/search?q=${encodeURIComponent(v.trim())}`, { signal: c.signal });
        if (!r.ok) throw new Error();
        setCards(((await r.json()) as { cards: Card[] }).cards);
        setState("idle");
      } catch {
        if (!c.signal.aborted) setState("error");
      }
    }, 280);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="vh">{t.pickTitle}</span>
        <MagnifyingGlassIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          autoFocus
          data-autofocus
          value={q}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t.pickPlaceholder}
          autoComplete="off"
          spellCheck={false}
          className="min-h-12 w-full rounded-xl border border-line bg-panel pl-10 pr-10 text-[16px] outline-none transition-[border-color] duration-150 focus:border-ink"
        />
        {state === "loading" && <CircleNotchIcon size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-label={t.searching} />}
      </label>
      <div aria-live="polite" className="min-h-[1px]">
        {state === "error" && <p className="text-[14px] text-down">{t.searchError}</p>}
        {state === "idle" && cards?.length === 0 && <p className="text-[14px] text-muted">{t.noResults}</p>}
      </div>
      {cards && cards.length > 0 && (
        <ul className="-mx-2 flex max-h-[min(52vh,420px)] flex-col overflow-y-auto">
          {cards.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-soft"
              >
                {c.imageThumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura del catálogo
                  <img src={c.imageThumbUrl} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-[4px] object-cover" />
                ) : (
                  <span className="h-14 w-10 shrink-0 rounded-[4px] bg-soft" />
                )}
                <span className="min-w-0">
                  <b className="block truncate text-[15px] font-semibold">{c.name}</b>
                  <span className="block truncate text-[13px] text-muted">{metaLine(c)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
