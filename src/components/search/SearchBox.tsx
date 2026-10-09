"use client";

import { ArrowDownIcon, ArrowRightIcon, MagnifyingGlassIcon, SealCheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { metaLine } from "@/lib/cards/format";
import type { Card } from "@/lib/cards/types";
import { useI18n } from "@/components/I18nProvider";
import { useCard } from "../CardContext";
import { Magnetic } from "../ui/Magnetic";

type Status = "idle" | "loading" | "done" | "error";
type MatchedSet = { code: string | null; name: string } | null;

// Buscador con autocompletado: debounce, cancelación de la petición anterior, caché por consulta
// y navegación con teclado (patrón combobox/listbox de ARIA). "/" lo enfoca desde cualquier sitio.
export function SearchBox() {
  const { t: dict } = useI18n();
  const t = dict.hero;
  const { card, setCard } = useCard();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<Card[]>([]);
  const [matchedSet, setMatchedSet] = useState<MatchedSet>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ctl = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cache = useRef(new Map<string, { cards: Card[]; matchedSet: MatchedSet }>());
  const root = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastQuery = useRef("");
  const listId = useId();

  const run = useCallback(async (text: string) => {
    const key = text.toLowerCase();
    lastQuery.current = text;
    const hit = cache.current.get(key);
    ctl.current?.abort();
    setOpen(true);
    setActive(-1);
    if (hit) {
      setResults(hit.cards);
      setMatchedSet(hit.matchedSet);
      setStatus("done");
      return;
    }
    const c = (ctl.current = new AbortController());
    setStatus("loading");
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(text)}`, { signal: c.signal });
      if (res.status === 429) throw new Error(t.errorRate);
      if (!res.ok) throw new Error(t.errorGeneric);
      const data = (await res.json()) as { cards: Card[]; matchedSet: MatchedSet };
      cache.current.set(key, data);
      setResults(data.cards);
      setMatchedSet(data.matchedSet);
      setStatus("done");
    } catch (e) {
      if (c.signal.aborted) return; // llegó una búsqueda más nueva
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : t.errorGeneric);
      setStatus("error");
    }
  }, [t.errorRate, t.errorGeneric]);

  // Al escribir: espera 250 ms sin teclear antes de consultar
  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      ctl.current?.abort();
      setStatus("idle");
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => run(v.trim()), 250);
  }

  function search(text: string) {
    setQ(text);
    run(text);
    input.current?.focus();
  }

  function choose(c: Card) {
    setOpen(false);
    setCard(c);
    setQ(c.name);
    input.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? results.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(results[active]); }
  }

  // Cerrar al hacer clic fuera; "/" enfoca el buscador (si no se está escribiendo en otro campo)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onSlash = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onSlash);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onSlash);
      if (timer.current) clearTimeout(timer.current);
      ctl.current?.abort();
    };
  }, []);

  return (
    <>
      <form
        ref={root}
        role="search"
        autoComplete="off"
        className="relative max-w-[600px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && results[active]) return choose(results[active]);
          if (timer.current) clearTimeout(timer.current);
          if (q.trim().length >= 2) run(q.trim());
        }}
      >
        <label htmlFor="q" className="vh">{t.searchLabel}</label>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel p-1.5 pl-4 transition-colors duration-300 focus-within:border-ink">
          <MagnifyingGlassIcon size={20} weight="bold" className="flex-none text-muted" aria-hidden />
          <input
            ref={input}
            id="q"
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            placeholder={t.searchPlaceholder}
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => status !== "idle" && setOpen(true)}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] outline-none placeholder:text-muted"
          />
          <kbd
            title={t.shortcut}
            className="hidden flex-none rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted md:inline-block"
          >
            /
          </kbd>
          <Magnetic>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 font-semibold text-panel transition-transform duration-200 active:scale-[0.97]"
            >
              {t.searchButton}
              <ArrowRightIcon size={16} weight="bold" aria-hidden />
            </button>
          </Magnetic>
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label={t.resultsLabel}
          hidden={!open}
          className="absolute inset-x-0 top-[calc(100%+8px)] z-20 max-h-[56vh] overflow-auto rounded-2xl bg-panel p-1.5 shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.08),0_28px_56px_-24px_rgb(var(--shadow-tint)/0.5)]"
        >
          {status === "loading" &&
            [0, 1, 2].map((i) => (
              <li key={i} role="presentation" className="flex items-center gap-3 px-3 py-2">
                <span className="skeleton h-[50px] w-9 flex-none rounded" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="skeleton h-3.5 w-2/5 rounded" />
                  <span className="skeleton h-3 w-3/4 rounded" />
                </span>
              </li>
            ))}
          {status === "error" && (
            <li role="presentation" className="flex items-start gap-3 px-3 py-3 text-[14px]">
              <WarningCircleIcon size={20} weight="fill" className="mt-0.5 flex-none text-down" aria-hidden />
              <span className="flex-1 text-muted">
                {error}{" "}
                <button type="button" className="font-semibold text-ink underline underline-offset-4" onClick={() => run(lastQuery.current)}>
                  {t.retry}
                </button>
              </span>
            </li>
          )}
          {status === "done" && !results.length && (
            <li role="presentation" className="flex items-start gap-3 px-3 py-3 text-[14px] text-muted">
              <MagnifyingGlassIcon size={20} className="mt-0.5 flex-none" aria-hidden />
              {t.noResults}
            </li>
          )}
          {status === "done" && matchedSet && results.length > 0 && (
            <li role="presentation" className="flex items-center gap-2 px-3 pb-1.5 pt-1 text-[12.5px] font-semibold text-muted">
              <SealCheckIcon size={16} weight="fill" className="text-up" aria-hidden />
              {t.inSet(matchedSet.name, matchedSet.code)}
            </li>
          )}
          {status === "done" &&
            results.map((c, i) => (
              <motion.li
                key={c.id}
                role="presentation"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.035 }}
              >
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 aria-selected:bg-soft"
                >
                  <span className="block h-[50px] w-9 flex-none overflow-hidden rounded bg-soft">
                    {c.imageThumbUrl && (
                      <Image src={c.imageThumbUrl} alt="" width={36} height={50} unoptimized className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="font-semibold">{c.name}</b>
                    <span className="truncate text-[13px] text-muted">{metaLine(c)}</span>
                  </span>
                  <span className="flex-none rounded-md border border-line px-1.5 text-[11.5px] font-semibold">{c.language}</span>
                  <ArrowRightIcon
                    size={16}
                    className="flex-none text-muted opacity-0 transition-opacity duration-150 group-aria-selected:opacity-100"
                    aria-hidden
                  />
                </button>
              </motion.li>
            ))}
        </ul>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
        <span>{t.trySuffix}</span>
        {t.suggestions.map((x) => (
          <button
            key={x.q}
            type="button"
            onClick={() => search(x.q)}
            className="min-h-9 rounded-full border border-line bg-panel/40 px-3.5 font-semibold text-ink transition-[border-color,transform] duration-200 hover:border-ink active:scale-[0.97]"
          >
            {x.text}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {t.codeHint}{" "}
        <button
          type="button"
          onClick={() => search(t.codeExample)}
          className="rounded-md bg-soft px-1.5 py-0.5 font-semibold text-ink transition-transform duration-200 active:scale-[0.97]"
        >
          {t.codeExample}
        </button>
      </p>
      {card && (
        <motion.a
          href="#precios"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="group mt-7 inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
        >
          {t.jump} {card.name}
          <ArrowDownIcon size={16} weight="bold" className="transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden />
        </motion.a>
      )}
    </>
  );
}
