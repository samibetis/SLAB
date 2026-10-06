import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

// Con DATABASE_URL se usa Neon (Postgres serverless por HTTP). Sin ella, en desarrollo se usa
// PGlite: un Postgres embebido que guarda los datos en .data/pglite y no necesita cuenta ni Docker.
// Las migraciones de Neon se aplican a mano con `npm run db:migrate`; las de PGlite, solas al arrancar.
const g = globalThis as unknown as { __slabDb?: Promise<Db> };

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ? path.resolve(process.env.PGLITE_DIR) : path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

// Una sola instancia por proceso (en desarrollo, el HMR recarga módulos y abriría PGlite varias veces).
export function getDb(): Promise<Db> {
  if (!g.__slabDb) {
    g.__slabDb = create().catch((e) => {
      g.__slabDb = undefined; // permite reintentar en la siguiente petición
      throw e;
    });
  }
  return g.__slabDb;
}
