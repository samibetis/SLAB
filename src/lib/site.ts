// Dirección pública de la web (para el sitemap, las URLs canónicas y las imágenes de redes sociales).
// NEXT_PUBLIC_SITE_URL si tienes dominio propio; si no, la de producción que da Vercel; en local, localhost.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
