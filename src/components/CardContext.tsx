"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Card } from "@/lib/cards/types";

// Carta elegida en el buscador. La leen el visor 3D, la cabecera de precios y el enlace "Ver precios".
// Las páginas siguen siendo de servidor; solo estos trozos interactivos leen el contexto.
interface Ctx {
  card: Card | null;
  setCard: (c: Card | null) => void;
}
const CardCtx = createContext<Ctx>({ card: null, setCard: () => {} });

export function CardProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<Card | null>(null);
  const value = useMemo(() => ({ card, setCard }), [card]);
  return <CardCtx.Provider value={value}>{children}</CardCtx.Provider>;
}

export const useCard = () => useContext(CardCtx);
