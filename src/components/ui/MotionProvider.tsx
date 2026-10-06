"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Todas las animaciones de `motion` respetan "reducir movimiento" del sistema
// y usan por defecto un muelle con peso (sin easings lineales).
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 100, damping: 20 }}>
      {children}
    </MotionConfig>
  );
}
