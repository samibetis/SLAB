import { sql } from "drizzle-orm";
import { bigserial, boolean, date, index, integer, jsonb, numeric, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { VariantOption } from "@/lib/cards/types";

// Caché del catálogo: cada carta consultada se guarda con su id propio y los ids de cada proveedor.
export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(), // "en-base1-4"
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    setId: text("set_id").notNull(),
    setName: text("set_name").notNull(),
    localId: text("local_id").notNull(),
    number: text("number").notNull(), // para mostrar: "4/102"
    year: integer("year"),
    language: text("language").notNull(), // 'EN' | 'JP'
    edition: text("edition"), // la edición real depende de la variante; ver `variants`
    rarity: text("rarity"),
    type: text("type"),
    imageUrl: text("image_url"),
    imageThumbUrl: text("image_thumb_url"),
    imageNeedsProxy: boolean("image_needs_proxy").notNull().default(false),
    externalIds: jsonb("external_ids").$type<Record<string, string>>().notNull().default({}),
    variants: jsonb("variants").$type<Record<string, boolean> | null>(),
    variantOptions: jsonb("variant_options").$type<VariantOption[] | null>(),
    releaseDate: text("release_date"),
    detailVersion: integer("detail_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cards_name_idx").on(t.name), index("cards_set_idx").on(t.setId)],
);

export type CardRow = typeof cards.$inferSelect;

// Histórico de precios: una fila por carta, versión, calificadora/nota, día y fuente.
// Muchas fuentes solo dan el precio actual, así que el histórico se construye guardando una
// instantánea al día (job programado del Hito 5). `grader`: RAW | PSA | BGS | CGC...; `grade` es null en RAW.
export const pricePoints = pgTable(
  "price_points",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    variant: text("variant").notNull(), // clave de VariantOption, o "standard"
    grader: text("grader").notNull(),
    grade: real("grade"),
    date: date("date", { mode: "string" }).notNull(),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("price_points_lookup_idx").on(t.cardId, t.variant, t.grader, t.grade, t.date),
    // evita duplicar la instantánea de un mismo día (coalesce: en RAW la nota es null)
    uniqueIndex("price_points_unique_idx").on(t.cardId, t.variant, t.grader, sql`coalesce(${t.grade}, -1)`, t.date, t.source),
  ],
);

export type PricePointRow = typeof pricePoints.$inferSelect;

// Colecciones y su código ("PAF" = Paldean Fates). Permite buscar por código de colección.
// En inglés el código es la abreviatura oficial; en japonés, el propio id de la colección ("SV4a").
export const sets = pgTable(
  "sets",
  {
    key: text("key").primaryKey(), // "en-sv04.5"
    id: text("id").notNull(), // id en el proveedor: "sv04.5"
    language: text("language").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    releaseDate: text("release_date"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sets_code_idx").on(t.code)],
);

export type SetRow = typeof sets.$inferSelect;
