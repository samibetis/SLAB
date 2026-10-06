import { sql } from "drizzle-orm";
import type { CardLanguage } from "@/lib/cards/types";
import type { SetInfo } from "@/lib/catalog/types";
import { getDb } from "./index";
import { sets } from "./schema";

// Colecciones guardadas y cuándo se refrescaron por última vez (para saber si toca volver a barrer).
export async function getStoredSets(): Promise<{ sets: SetInfo[]; updatedAt: Date | null }> {
  const db = await getDb();
  const rows = await db.select().from(sets);
  const newest = rows.reduce<Date | null>((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), null);
  return {
    updatedAt: newest,
    sets: rows.map((r) => ({
      key: r.key, id: r.id, language: r.language as CardLanguage, name: r.name,
      code: r.code, releaseDate: r.releaseDate ?? undefined,
    })),
  };
}

export async function upsertSets(list: SetInfo[]): Promise<void> {
  if (!list.length) return;
  const db = await getDb();
  // por lotes: cientos de filas con parámetros en una sola sentencia son demasiadas
  for (let i = 0; i < list.length; i += 100) {
    await db
      .insert(sets)
      .values(list.slice(i, i + 100).map((s) => ({
        key: s.key, id: s.id, language: s.language, name: s.name, code: s.code, releaseDate: s.releaseDate ?? null,
      })))
      .onConflictDoUpdate({
        target: sets.key,
        set: {
          name: sql`excluded.name`,
          code: sql`excluded.code`,
          releaseDate: sql`coalesce(excluded.release_date, ${sets.releaseDate})`,
          updatedAt: sql`now()`,
        },
      });
  }
}
