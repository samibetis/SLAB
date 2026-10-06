import type { Card } from "@/lib/cards/types";

// Reverso real de la carta. Hay tres diseños distintos:
//  - intl:   internacional (inglés y resto). Igual desde 1999 (Wizards of the Coast) hasta hoy.
//  - jp-old: japonés antiguo "Pocket Monsters Card Game" (1996 - mediados de 2001).
//  - jp:     japonés moderno (desde mediados de 2001).
export type BackKind = "intl" | "jp-old" | "jp";

export const BACK_FILES: Record<BackKind, string> = {
  intl: "/backs/intl.jpg",
  "jp-old": "/backs/jp-old.jpg",
  jp: "/backs/jp.jpg",
};

// Margen que se recorta de cada lado: los escaneos de los reversos japoneses traen bordes de más.
export const BACK_INSET: Record<BackKind, number> = { intl: 0.01, "jp-old": 0.022, jp: 0.018 };

// Japón cambió el reverso en julio de 2001: las colecciones anteriores llevan el antiguo.
const JP_BACK_CHANGE = "2001-07-01";

export function backFor(card: Pick<Card, "language" | "releaseDate" | "year"> | null | undefined): BackKind {
  if (!card || card.language !== "JP") return "intl";
  if (card.releaseDate) return card.releaseDate < JP_BACK_CHANGE ? "jp-old" : "jp";
  // sin fecha exacta (fila antigua de la caché): por año; 2001 se queda en moderno
  return card.year !== undefined && card.year <= 2000 ? "jp-old" : "jp";
}
