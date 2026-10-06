import type { Card } from "@/lib/cards/types";
import { getJson } from "@/lib/catalog/http";
import { insertPricePoints, lastSourceDate } from "@/lib/db/prices-repo";
import { SCRYDEX_SOURCE, scrydexEnabled, scrydexHistory } from "./scrydex";
import { rawPricePoints, type PricingDetail } from "./tcgdex-pricing";

// Servidor: instantánea diaria del precio raw real de una carta (todas sus versiones) desde TCGdex y,
// si hay proveedor de pago activo (Scrydex), su histórico por nota.
// Se toma la primera vez que alguien consulta la carta cada día y en el cron diario
// (/api/cron/snapshot-prices). La base de datos ignora la segunda del mismo día y fuente.

const API = "https://api.tcgdex.net/v2";
const LANG = { EN: "en", JP: "ja" } as const;

export const today = () => new Date().toISOString().slice(0, 10);

// Recuerda en memoria qué cartas ya se miraron hoy (con o sin precio) para no repetir la petición.
const done = new Map<string, string>();

// force: el cron la pide aunque hoy ya se mirara (p. ej. una carta sin precio que se reintenta).
type SnapCard = Pick<Card, "id" | "language" | "externalIds"> & Partial<Pick<Card, "name" | "localId" | "set" | "variantOptions">>;

export async function snapshotCard(card: SnapCard, opts: { signal?: AbortSignal; force?: boolean } = {}): Promise<number> {
  const { signal, force } = opts;
  const ext = card.externalIds.tcgdex;
  const day = today();
  if (!ext || (!force && done.get(card.id) === day)) return 0;
  // sin caché: el precio cambia cada día
  const d = await getJson<PricingDetail>(`${API}/${LANG[card.language]}/cards/${encodeURIComponent(ext)}`, { signal, revalidate: 0, timeoutMs: 6000 });
  const points = rawPricePoints(card.id, d, day);
  await insertPricePoints(points);
  const graded = await snapshotGraded(card).catch((e) => {
    console.warn("[prices] proveedor por nota:", e instanceof Error ? e.message : e);
    return 0;
  });
  done.set(card.id, day);
  return points.length + graded;
}

// Precios por nota del proveedor de pago: la primera vez, el último año; después, los últimos días
// (los repetidos se ignoran en la base de datos). Sin proveedor activo no hace nada.
async function snapshotGraded(card: SnapCard): Promise<number> {
  if (!scrydexEnabled() || !card.name || !card.localId || !card.variantOptions?.length) return 0;
  const days = (await lastSourceDate(card.id, SCRYDEX_SOURCE)) ? 3 : 365;
  let n = 0;
  for (const o of card.variantOptions) {
    const pts = await scrydexHistory({ id: card.id, name: card.name, localId: card.localId, set: card.set, externalIds: card.externalIds }, o, days);
    await insertPricePoints(pts);
    n += pts.length;
  }
  return n;
}

// Para la consulta de precios: espera la instantánea de hoy como mucho `ms`. Si TCGdex tarda más, la
// respuesta sigue con lo guardado y la instantánea termina por detrás (estará en la siguiente visita).
const pending = new Map<string, Promise<unknown>>();
export async function ensureSnapshot(card: SnapCard, ms = 2500): Promise<void> {
  if (!card.externalIds.tcgdex || done.get(card.id) === today()) return;
  let p = pending.get(card.id);
  if (!p) {
    p = snapshotCard(card)
      .catch((e) => console.warn("[prices] instantánea TCGdex:", e instanceof Error ? e.message : e))
      .finally(() => pending.delete(card.id));
    pending.set(card.id, p);
  }
  await Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
}
