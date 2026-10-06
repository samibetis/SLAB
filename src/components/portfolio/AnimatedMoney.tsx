"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/prices/format";

// Cantidad que cuenta hasta su valor: desde 0 la primera vez (si `from0`) y, después, desde la cifra
// anterior cuando cambia (al añadir o quitar un slab se ve cuánto sube o baja el total).
// El texto se escribe directamente en el nodo para no re-renderizar React en cada fotograma.
export function AnimatedMoney({ value, currency, from0 = false }: { value: number; currency: string; from0?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(from0 ? 0 : null);
  const reduced = useReducedMotion();
  // Texto inicial fijo: React no vuelve a tocar el nodo, lo actualiza el efecto
  const [initial] = useState(() => money(from0 ? 0 : value, currency));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current ?? value;
    let cur = from;
    if (reduced || from === value) {
      el.textContent = money(value, currency);
      shown.current = value;
      return;
    }
    const c = animate(from, value, {
      duration: from === 0 ? 1.1 : 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        cur = v;
        el.textContent = money(v >= 100 ? Math.round(v) : v, currency);
      },
      onComplete: () => {
        el.textContent = money(value, currency);
      },
    });
    shown.current = value;
    return () => {
      c.stop();
      // si se interrumpe (otro cambio, o el doble efecto del modo estricto), sigue desde donde iba
      shown.current = cur;
    };
  }, [value, currency, reduced]);

  return <span ref={ref}>{initial}</span>;
}
