"use client";

import { ArrowSquareOutIcon, CheckIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { variantLabel } from "@/lib/cards/format";
import { cardHref, cardImage } from "@/lib/collection/logic";
import type { AlbumCard, AlbumEntry, SetCard } from "@/lib/collection/types";
import type { CardStatus } from "@/lib/collection/versions";
import { es } from "@/lib/i18n/es";

// Bolsillos de la carpeta. Funda de plástico con la carta; las reverse llevan el brillo de su foil.
//  - Master set: un bolsillo por carta con todas sus versiones. Si solo cuenta una, un toque la marca;
//    si cuentan varias, se abre la lista de versiones y unos puntos indican cuáles tienes.
//  - Álbum libre: un bolsillo por versión, con su nombre debajo; pulsar abre esa versión.

const SLEEVE = "relative aspect-[63/88] overflow-hidden rounded-[5px] bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]";

export function EmptyPocket() {
  return <div className="aspect-[63/88] rounded-[5px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" aria-hidden />;
}

// La funda con la carta (común a los dos tipos de bolsillo).
function Sleeve({ card, owned, foil, children }: { card: AlbumCard; owned: boolean; foil?: boolean; children?: ReactNode }) {
  const img = cardImage(card);
  return (
    <div className={SLEEVE}>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element -- miniaturas de TCGdex ya optimizadas (webp pequeño)
        <img
          src={img}
          alt=""
          loading="lazy"
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover transition-[filter,opacity] duration-300 ${owned ? "" : "opacity-30 grayscale"}`}
        />
      )}
      {/* sin imagen en ninguna fuente: nombre y número, para que el bolsillo no parezca vacío */}
      {!img && (
        <span
          className={`absolute inset-[6%] flex flex-col justify-end rounded-[3px] border p-[6%] ${
            owned ? "border-ink/25 bg-panel text-ink" : "border-dashed border-ink/20 text-ink/60"
          }`}
        >
          <span className="line-clamp-3 text-[clamp(8px,1.6cqw,12.5px)] font-bold leading-tight">{card.name}</span>
          <span className="mt-[4%] text-[clamp(7px,1.3cqw,10.5px)] tabular-nums opacity-70">{card.number ?? card.localId}</span>
        </span>
      )}
      {!owned && img && <span className="absolute left-1.5 top-1 text-[clamp(8px,1.4cqw,11px)] font-bold tabular-nums text-ink/70">{card.localId}</span>}
      {/* foil de reverse holo: arcoíris suave que se mezcla con la imagen */}
      {foil && owned && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-45 mix-blend-color-dodge [background:linear-gradient(115deg,transparent_15%,#ff6fd8_32%,#7af5ff_48%,#fff38a_62%,transparent_80%)]"
        />
      )}
      {/* brillo de la funda de plástico */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255/0.32),transparent_38%,transparent_70%,rgb(255_255_255/0.12))]" />
      {children}
    </div>
  );
}

const OpenLink = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    title={es.collection.open}
    aria-label={`${es.collection.open}: ${label}`}
    className="absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-md bg-panel/90 text-ink opacity-0 shadow-sm transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100"
  >
    <ArrowSquareOutIcon size={13} weight="bold" aria-hidden />
  </a>
);

// Álbum libre: una versión concreta.
export function FreePocket({ entry }: { entry: AlbumEntry }) {
  const { card } = entry;
  const label = [card.name, card.number ?? card.localId, entry.variantName].filter(Boolean).join(" · ");
  const reverse = !!entry.variant && /(^|-)reverse(-|$)/.test(entry.variant);
  return (
    <div className="group">
      <Sleeve card={card} owned foil={reverse}>
        {/* la versión, como etiqueta sobre la funda (debajo descuadraría la página de 9) */}
        {entry.variantName && (
          <span className="pointer-events-none absolute inset-x-[6%] bottom-[3%] truncate rounded-full bg-panel/90 px-[1.6cqw] py-[0.6cqw] text-center text-[clamp(8px,1.5cqw,11.5px)] font-semibold text-ink shadow-sm">
            {entry.variantName}
          </span>
        )}
        <a href={cardHref(card, entry.variant)} aria-label={`${es.collection.open}: ${label}`} className="absolute inset-0 rounded-[5px]" />
      </Sleeve>
    </div>
  );
}

// Master set: la carta y sus versiones.
export function MasterPocket({
  card, status, onWhole, onVersion,
}: {
  card: SetCard;
  status: CardStatus;
  onWhole: (c: SetCard) => void;
  onVersion: (c: SetCard, key: string) => void;
}) {
  const t = es.collection;
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const multi = status.tracked.length > 1;
  const label = `${card.name} ${card.number ?? card.localId}`;
  // la funda se ve en color si tienes alguna versión; con foil si solo tienes reverse
  const onlyReverse = status.any && [...status.owned].every((k) => /(^|-)reverse(-|$)/.test(k));

  return (
    <div className="group relative">
      <Sleeve card={card} owned={status.any} foil={onlyReverse}>
        <button
          ref={btn}
          type="button"
          aria-pressed={multi ? undefined : status.any}
          aria-haspopup={multi ? "dialog" : undefined}
          aria-expanded={multi ? open : undefined}
          aria-label={multi ? `${label}: ${t.versionsOf(status.have, status.tracked.length)}` : `${label}: ${status.any ? t.owned : t.missing}`}
          onClick={() => (multi ? setOpen((o) => !o) : onWhole(card))}
          className="absolute inset-0 rounded-[5px] outline-offset-2 transition-transform duration-150 active:scale-[0.97]"
        />
        <OpenLink href={cardHref(card)} label={label} />
        {/* un punto por versión que cuenta: relleno si la tienes */}
        {multi && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[3%] flex justify-center">
            <span className="flex gap-[0.9cqw] rounded-full bg-panel/90 px-[1.4cqw] py-[0.9cqw] shadow-sm">
              {status.tracked.map((o) => (
                <span
                  key={o.key}
                  className={`size-[clamp(4px,1.2cqw,7px)] rounded-full ${status.owned.has(o.key) ? (o.type === "reverse" ? "bg-[linear-gradient(135deg,#ff6fd8,#7af5ff,#fff38a)]" : "bg-ink") : "ring-1 ring-inset ring-ink/35"}`}
                />
              ))}
            </span>
          </span>
        )}
      </Sleeve>
      {open && <VersionPicker anchor={btn} card={card} status={status} onVersion={onVersion} onClose={() => setOpen(false)} />}
    </div>
  );
}

// Lista de versiones de una carta, flotando junto al bolsillo. Va en un portal con posición fija para
// que no la recorte la carpeta (que tiene perspectiva 3D) y se recoloca para no salirse de la pantalla.
function VersionPicker({
  anchor, card, status, onVersion, onClose,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  card: SetCard;
  status: CardStatus;
  onVersion: (c: SetCard, key: string) => void;
  onClose: () => void;
}) {
  const t = es.collection;
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect();
    const b = box.current?.getBoundingClientRect();
    if (!a || !b) return;
    const left = Math.min(Math.max(8, a.left + a.width / 2 - b.width / 2), innerWidth - b.width - 8);
    const below = a.bottom + 8 + b.height < innerHeight;
    setPos({ left, top: below ? a.bottom + 8 : Math.max(8, a.top - b.height - 8) });
  }, [anchor]);

  useEffect(() => {
    const out = (e: PointerEvent) => !box.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        anchor.current?.focus();
      }
    };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, { passive: true });
    box.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", out);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose);
    };
  }, [anchor, onClose]);

  const all = status.tracked.every((o) => status.owned.has(o.key));
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={`${t.versionsTitle}: ${card.name}`}
      className="fixed z-50 w-[248px] rounded-2xl bg-panel p-2 text-ink shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.1),0_24px_48px_-20px_rgb(var(--shadow-tint)/0.55)] motion-safe:animate-[dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)]"
      style={pos ?? { left: -9999, top: 0 }}
    >
      <div className="flex items-baseline justify-between gap-2 px-2.5 pb-1.5 pt-1">
        <p className="truncate text-[14px] font-bold">{card.name}</p>
        <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{card.number ?? card.localId}</span>
      </div>
      <ul>
        {status.tracked.map((o) => {
          const on = status.owned.has(o.key);
          return (
            <li key={o.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onVersion(card, o.key)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition-colors duration-150 hover:bg-soft"
              >
                <span className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] transition-colors duration-150 ${on ? "bg-ink text-panel" : "ring-[1.5px] ring-inset ring-line"}`}>
                  {on && <CheckIcon size={12} weight="bold" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 truncate">{variantLabel(o)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex items-center justify-between border-t border-line px-2.5 pt-2 text-[13px] font-semibold">
        <span className="tabular-nums text-muted">{t.versionsOf(status.have, status.tracked.length)}</span>
        <button
          type="button"
          onClick={() => status.tracked.filter((o) => status.owned.has(o.key) === all).forEach((o) => onVersion(card, o.key))}
          className="rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-soft"
        >
          {all ? t.markNone : t.markAll}
        </button>
      </div>
    </div>,
    document.body,
  );
}
