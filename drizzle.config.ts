import { defineConfig } from "drizzle-kit";

// `npm run db:generate` crea la migración SQL en /drizzle a partir de src/lib/db/schema.ts.
// `npm run db:migrate` la aplica a la base de DATABASE_URL (Neon).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
