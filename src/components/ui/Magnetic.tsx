"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { ReactNode } from "react";

// Envoltorio "magnético": su contenido se desplaza unos píxeles hacia el cursor.
// Usa valores de movimiento (no estado de React), así no provoca renders en cada movimiento del ratón.
export function Magnetic({ children, strength = 0.22, max = 6, className }: {
  children: ReactNode;
  strength?: number;
  max?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  return (
    <motion.span
      className={className}
      style={{ x: sx, y: sy, display: "inline-flex" }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const b = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - (b.left + b.width / 2)) * strength;
        const dy = (e.clientY - (b.top + b.height / 2)) * strength;
        x.set(Math.max(-max, Math.min(max, dx)));
        y.set(Math.max(-max, Math.min(max, dy)));
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
