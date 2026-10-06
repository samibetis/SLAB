"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { paginate } from "@/lib/collection/logic";
import { es } from "@/lib/i18n/es";
import { EmptyPocket } from "./Pocket";

// Carpeta en 3D. Se numeran "huecos": el 0 es la portada interior y del 1 en adelante, las páginas de
// 9 bolsillos. En escritorio se ven de dos en dos (pliego: hueco par a la izquierda, impar a la derecha);
// al pasar, una hoja gira 180° sobre el lomo enseñando su anverso y luego su reverso.

type Flip = { dir: 1 | -1; from: number } | null;
const EASE = [0.32, 0.72, 0, 1] as const; // arranque firme, final suave: como una hoja de verdad

// ¿Pantalla estrecha? (una página cada vez). En el servidor se asume escritorio.
const NARROW = "(max-width: 767px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(NARROW).matches,
    () => false,
  );
}

// Una página de papel. `side` decide qué esquinas se redondean y hacia dónde cae la sombra del lomo.
function Page({ children, side }: { children: ReactNode; side: "left" | "right" | "single" }) {
  return (
    <div
      className={`@container relative h-full bg-[color-mix(in_srgb,var(--panel)_92%,var(--ink))] ${
        side === "left" ? "rounded-l-[10px]" : side === "right" ? "rounded-r-[10px]" : "rounded-[10px]"
      }`}
    >
      {children}
      {side !== "single" && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 w-[9%] ${
            side === "left"
              ? "right-0 bg-[linear-gradient(to_left,rgb(var(--shadow-tint)/0.16),transparent)]"
              : "left-0 bg-[linear-gradient(to_right,rgb(var(--shadow-tint)/0.16),transparent)]"
          }`}
        />
      )}
    </div>
  );
}

// Genérica: recibe los elementos y cómo pintar cada bolsillo (master set o álbum libre).
export function Binder<T>({
  items, itemKey, renderItem, cover,
}: {
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  cover: ReactNode;
}) {
  const t = es.collection;
  const reduce = useReducedMotion();
  const narrow = useNarrow();
  const pages = paginate(items);
  const slots = pages.length + 1; // portada + páginas
  const spreads = Math.ceil(slots / 2);
  const [spread, setSpread] = useState(0); // escritorio: pliego visible
  const [single, setSingle] = useState(0); // móvil: hueco visible
  const [flip, setFlip] = useState<Flip>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const flipping = useRef<number | null>(null); // giro en curso (para no cerrarlo dos veces)

  // Termina el giro. Lo llama la animación al acabar o, por seguridad, un temporizador: si la pestaña
  // queda oculta el navegador pausa las animaciones y la carpeta se quedaría bloqueada a medio giro.
  function finishFlip(id: number, to: number) {
    if (flipping.current !== id) return;
    flipping.current = null;
    setSpread(to);
    setFlip(null);
  }

  const slot = (i: number): ReactNode => {
    if (i === 0) return cover;
    const page = pages[i - 1];
    if (!page) return null; // contraportada vacía
    return (
      <div className="grid h-full grid-cols-3 content-center gap-[2.6cqw] p-[4.5cqw]">
        {page.map((it, k) => (it === null ? <EmptyPocket key={`empty-${k}`} /> : <div key={itemKey(it)}>{renderItem(it)}</div>))}
      </div>
    );
  };

  const canPrev = narrow ? single > 0 : spread > 0;
  const canNext = narrow ? single < slots - 1 : spread < spreads - 1;

  function go(d: 1 | -1) {
    if (flip || (d === 1 ? !canNext : !canPrev)) return;
    if (narrow) {
      setDir(d);
      setSingle((s) => s + d);
    } else if (reduce) setSpread((s) => s + d);
    else {
      const id = Date.now();
      flipping.current = id;
      setFlip({ dir: d, from: spread });
      setTimeout(() => finishFlip(id, spread + d), 1000);
    }
  }

  // Texto "Páginas 3–4 de 11" (la portada no cuenta como página)
  const pageLabel = narrow
    ? single === 0 ? t.cover : String(single)
    : spread === 0 ? `${t.cover} · 1` : `${2 * spread}–${Math.min(2 * spread + 1, pages.length)}`;

  // Durante el giro: debajo, a la izquierda y derecha, lo que quedará visible al terminar
  const k = flip ? flip.from : spread;
  const under = flip
    ? flip.dir === 1 ? [2 * k, 2 * k + 3] : [2 * k - 2, 2 * k + 1]
    : [2 * k, 2 * k + 1];

  return (
    <div
      tabIndex={0}
      aria-roledescription="carpeta"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
      className="rounded-2xl outline-offset-8"
    >
      {narrow ? (
        <div className="relative mx-auto w-full max-w-[460px] [perspective:1600px]">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={single}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { rotateY: dir === 1 ? 60 : -60, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { rotateY: dir === 1 ? -60 : 60, opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              style={{ transformOrigin: dir === 1 ? "left center" : "right center" }}
              className="aspect-[3/4] rounded-[12px] p-[6px] shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.1),0_28px_50px_-26px_rgb(var(--shadow-tint)/0.55)] [background:var(--ink)]"
            >
              <Page side="single">{slot(single)}</Page>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="relative mx-auto w-full max-w-[1080px] [perspective:2400px]">
          {/* tapas de la carpeta */}
          <div className="grid grid-cols-2 rounded-[16px] p-[7px] shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.1),0_36px_70px_-34px_rgb(var(--shadow-tint)/0.6)] [background:var(--ink)]">
            <div className="aspect-[3/4]"><Page side="left">{slot(under[0])}</Page></div>
            <div className="aspect-[3/4]"><Page side="right">{slot(under[1])}</Page></div>
          </div>
          {/* hoja que gira */}
          {flip && (
            <motion.div
              className="absolute top-[7px] bottom-[7px] w-[calc(50%-7px)] [transform-style:preserve-3d]"
              style={{
                left: flip.dir === 1 ? "50%" : "7px",
                transformOrigin: flip.dir === 1 ? "left center" : "right center",
              }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: flip.dir === 1 ? -180 : 180 }}
              transition={{ duration: 0.75, ease: EASE }}
              onAnimationComplete={() => flipping.current && finishFlip(flipping.current, flip.from + flip.dir)}
            >
              <div className="absolute inset-0 [backface-visibility:hidden]">
                <Page side={flip.dir === 1 ? "right" : "left"}>{slot(flip.dir === 1 ? 2 * k + 1 : 2 * k)}</Page>
              </div>
              <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <Page side={flip.dir === 1 ? "left" : "right"}>{slot(flip.dir === 1 ? 2 * k + 2 : 2 * k - 1)}</Page>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* pasar página */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!canPrev}
          aria-label={t.prev}
          className="grid size-11 place-items-center rounded-full bg-panel text-ink transition-[opacity,transform] duration-200 active:scale-[0.94] disabled:opacity-35"
        >
          <CaretLeftIcon size={18} weight="bold" aria-hidden />
        </button>
        <p className="min-w-[10ch] text-center text-[14px] font-semibold tabular-nums text-muted" aria-live="polite">
          {t.pageOf(pageLabel, pages.length)}
        </p>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!canNext}
          aria-label={t.next}
          className="grid size-11 place-items-center rounded-full bg-panel text-ink transition-[opacity,transform] duration-200 active:scale-[0.94] disabled:opacity-35"
        >
          <CaretRightIcon size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
