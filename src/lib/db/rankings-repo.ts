import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { setRankings, type SetRankingRow } from "./schema";

// Rankings de colecciones (ver lib/rankings).

export async function upsertRanking(row: Omit<SetRankingRow, "scannedAt">): Promise<void> {
  const db = await getDb();
  await db
    .insert(setRankings)
    .values({ ...row, scannedAt: new Date() })
    .onConflictDoUpdate({ target: setRankings.setKey, set: { ...row, scannedAt: new Date() } });
}

export async function getRanking(setKey: string): Promise<SetRankingRow | null> {
  const db = await getDb();
  const [r] = await db.select().from(setRankings).where(eq(setRankings.setKey, setKey)).limit(1);
  return r ?? null;
}

export async function listRankings(language: string): Promise<SetRankingRow[]> {
  const db = await getDb();
  return db.select().from(setRankings).where(eq(setRankings.language, language));
}
