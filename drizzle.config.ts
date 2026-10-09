import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit no lee .env.local por su cuenta: se cargan las variables igual que hace Next.js.
loadEnvConfig(process.cwd());

// `npm run db:generate` crea la migración SQL en /drizzle a partir de src/lib/db/schema.ts.
// `npm run db:migrate` la aplica a la base de DATABASE_URL (Neon), definida en .env.local.
const url = process.env.DATABASE_URL;
if (!url && process.argv.some((a) => a === "migrate")) {
  throw new Error("Falta DATABASE_URL: pon la connection string de Neon en .env.local (DATABASE_URL=postgres://...)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url ?? "" },
});
