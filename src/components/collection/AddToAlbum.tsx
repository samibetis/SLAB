"use client";

import { BookmarkSimpleIcon, CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { variantLabel } from "@/lib/cards/format";
import { addCard, belongsTo, newId, toAlbumCard } from "@/lib/collection/logic";
import { browserStore } from "@/lib/collection/store";
import type { Album, SetCard } from "@/lib/collection/types";
import { markVersion, ownedKeys } from "@/lib/collection/versions";
import { es } from "@/lib/i18n/es";
import { useCard } from "../CardContext";
import { usePrices } from "../prices/PriceContext";
import { useAlbums } from "./useAlbums";

// "Añadir a un álbum" en la ficha de la carta. Propone primero el master set de su colección.
// En un master set marca la versión que tienes puesta en el visor (todas comparten bolsillo); en un
// álbum libre, esa versión entra como bolsillo propio.
export function AddToAlbum() {
  const t = es.collection;
  const { card } = useCard();
  const { variant, variants } = usePrices();
  const { albums } = useAlbums();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!card) return null;
  const setCard: SetCard = { ...toAlbumCard(card), variants: card.variantOptions ?? [] };
  const option = variants.find((o) => o.key === variant);
  // ¿Ya está esta versión en el álbum?
  const hasIt = (a: Album) =>
    a.kind === "master" ? ownedKeys(a, setCard).has(variant) : a.entries.some((e) => e.card.id === card.id && e.variant === variant);
  const list = [...(albums ?? [])]
    .filter((a) => a.kind === "free" || belongsTo(a, card.id))
    .sort((a, b) => Number(belongsTo(b, card.id)) - Number(belongsTo(a, card.id)));

  async function add(album: Album) {
    if (!card) return;
    try {
      const next =
        album.kind === "master"
          ? markVersion(album, setCard, variant)
          : addCard(album, toAlbumCard(card), variant, new Date(), option ? variantLabel(option) : undefined);
      await browserStore.save(next);
      setDone(album.name);
      setOpen(false);
      setTimeout(() => setDone(null), 2600);
    } catch {
      alert(t.storageError);
    }
  }

  async function addToNew() {
    if (!card) return;
    const now = new Date().toISOString();
    await add({ id: newId(), name: card.set ? `${card.set}` : card.name, kind: "free", entries: [], createdAt: now, updatedAt: now });
  }

  return (
    <div ref={root} className="relative inline-flex items-center gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-soft px-3.5 text-[13.5px] font-semibold transition-[background-color,transform] duration-200 hover:bg-line/60 active:scale-[0.97]"
      >
        <BookmarkSimpleIcon size={16} weight="bold" aria-hidden />
        {t.addToAlbum}
      </button>
      <AnimatePresence>
        {done && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-up"
            role="status"
          >
            <CheckIcon size={15} weight="bold" aria-hidden />
            {t.addedTo(done)}
          </motion.span>
        )}
      </AnimatePresence>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[300px] rounded-2xl bg-panel p-2 shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.08),0_24px_48px_-20px_rgb(var(--shadow-tint)/0.5)]">
          <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t.addTitle}</p>
          {list.length === 0 && <p className="px-2.5 py-2 text-[14px] text-muted">{t.addNone}</p>}
          <ul>
            {list.map((a) => {
              const inIt = hasIt(a);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => add(a)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[14px] transition-colors duration-150 hover:bg-soft"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-semibold">{a.name}</b>
                      <span className="text-[12px] text-muted">{belongsTo(a, card.id) ? t.suggested : a.kind === "master" ? t.master : t.free}</span>
                    </span>
                    {inIt && <span className="text-[12px] font-semibold text-up">{t.alreadyIn}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={addToNew}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-line px-2.5 py-2.5 text-left text-[14px] font-semibold transition-colors duration-150 hover:bg-soft"
          >
            <PlusIcon size={15} weight="bold" aria-hidden />
            {t.addNewFree}
          </button>
        </div>
      )}
    </div>
  );
}
