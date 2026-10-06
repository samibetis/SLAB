import { gradeKey } from "./grades";
import type { PricePoint, Row } from "./types";

// Precios que pone el usuario a mano (sin proveedor de pago, los precios por nota salen de aquí).
// Se guardan en su navegador como puntos normales con source "manual". Lógica pura: ids, mezcla con
// los precios del servidor y con las series mensuales del portafolio.

export const MANUAL_SOURCE = "manual";

export interface ManualPrice extends PricePoint {
  id: string; // "<carta>|<versión>|<clave de nota>|<fecha>": un precio por nota y día (el último gana)
  note?: string; // de dónde lo sacó: "venta en eBay", "tienda"...
  createdAt: string;
}

export const manualId = (cardId: string, variant: string, key: string, date: string) => `${cardId}|${variant}|${key}|${date}`;
// Prefijo para leer de golpe los de una carta y versión
export const manualPrefix = (cardId: string, variant: string) => `${cardId}|${variant}|`;

export function makeManual(
  p: Pick<PricePoint, "cardId" | "variant" | "grader" | "grade" | "date" | "price" | "currency">,
  note?: string,
  now = new Date(),
): ManualPrice {
  const key = gradeKey(p.grader, p.grade);
  return {
    ...p,
    grader: p.grader.toUpperCase(),
    price: Math.round(p.price * 100) / 100,
    source: MANUAL_SOURCE,
    id: manualId(p.cardId, p.variant, key, p.date),
    ...(note?.trim() ? { note: note.trim().slice(0, 80) } : {}),
    createdAt: now.toISOString(),
  };
}

// Mezcla con los puntos del servidor: en cada nota donde el usuario ha puesto precios, mandan los suyos
// (sustituyen a los del servidor de esa nota); en las demás se queda lo del servidor (p. ej. el raw real).
export function mergeManual(server: PricePoint[], manual: PricePoint[]): PricePoint[] {
  if (!manual.length) return server;
  const own = new Set(manual.map((p) => gradeKey(p.grader, p.grade)));
  return [...server.filter((p) => !own.has(gradeKey(p.grader, p.grade))), ...manual];
}

// Lo mismo sobre series mensuales (el portafolio recibe filas ya agregadas del servidor): para cada
// clave con precios propios, sus meses sustituyen a los del servidor.
export function overrideRows(server: Row[], own: Row[], keys: string[]): Row[] {
  const mine = keys.filter((k) => own.some((r) => r.p[k] != null));
  if (!mine.length) return server;
  const months = [...new Set([...server.map((r) => r.t), ...own.map((r) => r.t)])].sort();
  return months.map((t) => {
    const s = server.find((r) => r.t === t)?.p ?? {};
    const o = own.find((r) => r.t === t)?.p ?? {};
    return { t, p: Object.fromEntries(keys.map((k) => [k, mine.includes(k) ? (o[k] ?? null) : (s[k] ?? null)])) };
  });
}
