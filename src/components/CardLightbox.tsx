"use client";

import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { LightboxCard } from "./viewer/LightboxViewer";

// three.js solo se descarga al abrir la primera carta
const LightboxViewer = dynamic(() => import("./viewer/LightboxViewer"), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

function ViewerLoading() {
  const { t: dict } = useI18n();
  return <div className="skeleton mx-auto aspect-[63/88] h-[70%] rounded-[14px]" aria-label={dict.viewer.loading} />;
}

export interface LightboxItem {
  card: LightboxCard;
  title: string; // "Charizard"
  subtitle?: string; // "4/102 · Holo · Unlimited"
  badge?: string; // "928 US$"
  href: string; // ficha completa (precios, versiones, funda)
}

// Ver una carta de cerca sin salir de la página: ventana encima, fondo oscurecido y el visor 3D sin
// funda. Se cierra con la X, pulsando fuera o con Escape; las flechas (o ← →) pasan a la anterior/siguiente.
export function CardLightbox({ items, index, onIndex, onClose }: { items: LightboxItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const { t: dict } = useI18n();
  const t = dict.lightbox;
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null;
  const item = open ? items[index] : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = (step: number) => index !== null && onIndex((index + step + items.length) % items.length);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      aria-label={item ? item.title : t.label}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-ink backdrop:bg-[rgb(var(--shadow-tint)/0.72)] backdrop:backdrop-blur-[3px] open:animate-[dialog-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:open:animate-none"
    >
      {item && (
        // pulsar en el hueco (fuera de la carta y de la ficha) también cierra
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-3 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label={dict.ui.close}
              className="grid size-11 place-items-center rounded-full bg-panel text-ink shadow-md transition-transform duration-150 active:scale-[0.94]"
            >
              <XIcon size={20} weight="bold" aria-hidden />
            </button>
          </div>

          {/* zona del visor: ocupa el espacio que haya (el motor encuadra la carta a cualquier tamaño);
              las flechas flotan a los lados para no robar anchura en móvil */}
          <div className="relative mx-auto h-full min-h-0 w-full max-w-[720px]" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="absolute inset-0">
              <LightboxViewer card={item.card} />
            </div>
            {items.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t.prev} className="absolute left-0 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-panel/90 shadow-md transition-transform duration-150 active:scale-[0.94]">
                  <CaretLeftIcon size={18} weight="bold" aria-hidden />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={t.next} className="absolute right-0 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-panel/90 shadow-md transition-transform duration-150 active:scale-[0.94]">
                  <CaretRightIcon size={18} weight="bold" aria-hidden />
                </button>
              </>
            )}
          </div>

          <div className="mx-auto flex w-full max-w-[620px] flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl bg-panel px-5 py-4 shadow-lg">
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold">{item.title}</p>
              {item.subtitle && <p className="truncate text-[13.5px] text-muted">{item.subtitle}</p>}
            </div>
            <div className="flex items-center gap-4">
              {item.badge && <span className="text-[19px] font-extrabold tabular-nums [font-stretch:110%]">{item.badge}</span>}
              <Link href={item.href} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[13.5px] font-semibold text-panel transition-transform duration-150 active:scale-[0.97]">
                {t.full} <ArrowRightIcon size={14} weight="bold" aria-hidden />
              </Link>
            </div>
            <p className="w-full text-[12.5px] text-muted">{t.hint}</p>
          </div>
        </div>
      )}
    </dialog>
  );
}
