import { eq, inArray, sql } from "drizzle-orm";
import type { Card, CardLanguage } from "@/lib/cards/types";
import { getDb } from "./index";
import { cards, type CardRow } from "./schema";

export const toCard = (r: CardRow): Card => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  set: r.setName,
  setId: r.setId,
  localId: r.localId,
  number: r.number,
  year: r.year ?? undefined,
  language: r.language as CardLanguage,
  edition: r.edition ?? undefined,
  rarity: r.rarity ?? undefined,
  type: r.type ?? undefined,
  imageUrl: r.imageUrl,
  imageThumbUrl: r.imageThumbUrl,
  imageNeedsProxy: r.imageNeedsProxy,
  externalIds: r.externalIds,
  variants: r.variants,
  variantOptions: r.variantOptions,
  releaseDate: r.releaseDate ?? undefined,
  detailVersion: r.detailVersion,
});

const toRow = (c: Card): typeof cards.$inferInsert => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  setId: c.setId,
  setName: c.set ?? "",
  localId: c.localId,
  number: c.number ?? c.localId,
  year: c.year ?? null,
  language: c.language,
  edition: c.edition ?? null,
  rarity: c.rarity ?? null,
  type: c.type ?? null,
  imageUrl: c.imageUrl,
  imageThumbUrl: c.imageThumbUrl,
  imageNeedsProxy: c.imageNeedsProxy,
  externalIds: c.externalIds,
  variants: c.variants,
  variantOptions: c.variantOptions,
  releaseDate: c.releaseDate ?? null,
  detailVersion: c.detailVersion ?? 1,
});

export async function getCardsByIds(ids: string[]): Promise<Card[]> {
  if (!ids.length) return [];
  const db = await getDb();
  return (await db.select().from(cards).where(inArray(cards.id, ids))).map(toCard);
}

export async function getCardById(id: string): Promise<Card | null> {
  const db = await getDb();
  const [r] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return r ? toCard(r) : null;
}

export async function getCardBySlug(slug: string): Promise<Card | null> {
  const db = await getDb();
  const [r] = await db.select().from(cards).where(eq(cards.slug, slug)).limit(1);
  return r ? toCard(r) : null;
}

// Inserta o actualiza. Los ids externos se fusionan: si dos proveedores describen la misma carta,
// la fila acaba con los dos.
export async function upsertCards(list: Card[]): Promise<void> {
  if (!list.length) return;
  const db = await getDb();
  await db
    .insert(cards)
    .values(list.map(toRow))
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        name: sql`excluded.name`,
        setName: sql`excluded.set_name`,
        number: sql`excluded.number`,
        year: sql`coalesce(excluded.year, ${cards.year})`,
        rarity: sql`coalesce(excluded.rarity, ${cards.rarity})`,
        type: sql`coalesce(excluded.type, ${cards.type})`,
        imageUrl: sql`coalesce(excluded.image_url, ${cards.imageUrl})`,
        imageThumbUrl: sql`coalesce(excluded.image_thumb_url, ${cards.imageThumbUrl})`,
        imageNeedsProxy: sql`case when excluded.image_url is null then ${cards.imageNeedsProxy} else excluded.image_needs_proxy end`,
        externalIds: sql`${cards.externalIds} || excluded.external_ids`,
        variants: sql`coalesce(excluded.variants, ${cards.variants})`,
        variantOptions: sql`coalesce(excluded.variant_options, ${cards.variantOptions})`,
        releaseDate: sql`coalesce(excluded.release_date, ${cards.releaseDate})`,
        detailVersion: sql`greatest(excluded.detail_version, ${cards.detailVersion})`,
        updatedAt: sql`now()`,
      },
    });
}
