import { and, asc, desc, eq, inArray, max, notExists, sql } from "drizzle-orm";
import type { Card } from "@/lib/cards/types";
import type { PricePoint } from "@/lib/prices/types";
import { toCard } from "./cards-repo";
import { getDb } from "./index";
import { cards, pricePoints } from "./schema";

export async function getPricePoints(cardId: string, variant: string): Promise<PricePoint[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pricePoints)
    .where(and(eq(pricePoints.cardId, cardId), eq(pricePoints.variant, variant)))
    .orderBy(asc(pricePoints.date));
  return rows.map((r) => ({
    cardId: r.cardId, variant: r.variant, grader: r.grader, grade: r.grade,
    date: r.date, price: r.price, currency: r.currency, source: r.source,
  }));
}

// Cartas de TCGdex en caché que aún no tienen instantánea de precio raw de ese día (para el cron diario).
// Las que TCGdex no tiene con precio se vuelven a mirar cada día: es una petición barata.
export async function cardsWithoutSnapshot(day: string, limit: number): Promise<Card[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(cards)
    .where(
      and(
        sql`${cards.externalIds} ? 'tcgdex'`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(pricePoints)
            .where(and(eq(pricePoints.cardId, cards.id), eq(pricePoints.date, day), inArray(pricePoints.source, ["tcgplayer", "cardmarket"]))),
        ),
      ),
    )
    .orderBy(desc(cards.updatedAt))
    .limit(limit);
  return rows.map(toCard);
}

// Última fecha guardada de una fuente para una carta (para pedir al proveedor solo lo que falta).
export async function lastSourceDate(cardId: string, source: string): Promise<string | null> {
  const db = await getDb();
  const [r] = await db
    .select({ d: max(pricePoints.date) })
    .from(pricePoints)
    .where(and(eq(pricePoints.cardId, cardId), eq(pricePoints.source, source)));
  return r?.d ?? null;
}

// Guarda instantáneas; una por carta, versión, grado, día y fuente (si ya existe, se deja como está).
export async function insertPricePoints(points: PricePoint[]): Promise<void> {
  if (!points.length) return;
  const db = await getDb();
  await db.insert(pricePoints).values(points).onConflictDoNothing();
}
