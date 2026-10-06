"use client";

import Link from "next/link";
import { useRef } from "react";
import { cardHref } from "@/lib/collection/logic";
import { gradeOption } from "@/lib/grading/companies";
import { es } from "@/lib/i18n/es";
import type { HoldingStat } from "@/lib/portfolio/logic";
import type { Holding } from "@/lib/portfolio/types";
import { money } from "@/lib/prices/format";
import { SlabThumb } from "./SlabThumb";

// Posición de cada funda en el abanico (x en % del ancho de la vitrina, giro en grados), cerrado y
// abierto. La del centro es la de más valor y va encima.
const FAN: Record<number, { x: number; r: number; xo: number; ro: number }[]> = {
  1: [{ x: 0, r: -2, xo: 0, ro: 0 }],
  2: [{ x: -14, r: -6, xo: -22, ro: -8 }, { x: 14, r: 5, xo: 22, ro: 7 }],
  3: [{ x: -24, r: -9, xo: -34, ro: -12 }, { x: 0, r: -1, xo: 0, ro: 0 }, { x: 24, r: 8, xo: 34, ro: 11 }],
};

const slabHref = (h: Holding) => `${cardHref(h.card)}&variant=${encodeURIComponent(h.variant)}&grader=${h.grader}&grade=${encodeURIComponent(h.gradeId)}`;

// Vitrina: tus tres slabs de más valor en abanico. Al entrar se reparten sobre la mesa y se revela
// su nota; con el ratón, la funda que tocas se inclina hacia él y el brillo del plástico le sigue.
export function Showcase({ stats, play, fresh }: { stats: HoldingStat[]; play: boolean; fresh: Set<string> }) {
  const top = [...stats].sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || b.h.addedAt.localeCompare(a.h.addedAt)).slice(0, 3);
  // la de más valor en el centro: [2ª, 1ª, 3ª]
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const fan = FAN[order.length] ?? [];

  return (
    <ul className="showcase @container relative mx-auto aspect-[4/3] w-full max-w-[min(440px,100%)] md:w-[clamp(320px,32vw,460px)]">
      {order.map((s, i) => (
        <li
          key={s.h.id}
          className="showcase-slot absolute left-1/2 top-1/2 w-[40%]"
          style={{
            ["--x" as string]: `${fan[i].x}cqw`, ["--r" as string]: `${fan[i].r}deg`,
            ["--xo" as string]: `${fan[i].xo}cqw`, ["--ro" as string]: `${fan[i].ro}deg`,
            zIndex: s === top[0] ? 3 : 2 - i,
          }}
        >
          <div
            className={play || fresh.has(s.h.id) ? "slab-deal" : ""}
            style={{ ["--d" as string]: `${i * 110}ms`, ["--deal-r" as string]: `${fan[i].r * 2.2}deg` }}
          >
            <Tilt>
              <Link
                href={slabHref(s.h)}
                aria-label={`${es.portfolio.open}: ${s.h.card.name}, ${s.h.grader} ${gradeOption(s.h.grader, s.h.gradeId).value}${s.price != null ? `, ${money(s.price, s.h.currency)}` : ""}`}
                className="group/slab block rounded-[6%] focus-visible:outline-offset-4"
              >
                <SlabThumb card={s.h.card} grader={s.h.grader} gradeId={s.h.gradeId} reveal={play || fresh.has(s.h.id)} delay={i * 110 + 260} glare />
                {s.price != null && (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-panel opacity-0 transition-[opacity,transform] duration-200 group-hover/slab:translate-y-0 group-hover/slab:opacity-100 group-focus-visible/slab:translate-y-0 group-focus-visible/slab:opacity-100">
                    {money(s.price, s.h.currency)}
                  </span>
                )}
              </Link>
            </Tilt>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Inclinación 3D hacia el puntero. Escribe estilos directamente (sin re-render de React en cada
// movimiento). Solo con ratón o lápiz y sin "reducir movimiento": en táctil el gesto es para el scroll.
function Tilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || reduced()) return;
    const el = ref.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transition = "transform 120ms ease-out";
      el.style.transform = `perspective(800px) translateY(-6%) rotateX(${(-py * 16).toFixed(2)}deg) rotateY(${(px * 20).toFixed(2)}deg) scale(1.05)`;
      el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--glare", "1");
    });
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.transition = "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = "";
    el.style.setProperty("--glare", "0");
  };

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className="relative [transform-style:preserve-3d]">
      {children}
    </div>
  );
}
