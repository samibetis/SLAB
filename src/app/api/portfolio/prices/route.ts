import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureCard } from "@/lib/catalog/ensure";
import { getPriceHistory } from "@/lib/prices/service";
import { pointsToSeries } from "@/lib/prices/series";
import type { Row, SeriesSource } from "@/lib/prices/types";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/portfolio/prices  { items: [{ id, ext, lang, variant, keys: ["psa10"] }] }
// -> { series: { "<id>|<variant>": { rows, currency } | null }, sources: SeriesSource[] }
// Una sola petición para todo el portafolio: la serie mensual de cada carta y versión, solo con las
// notas que usan tus slabs. El portafolio vive en el navegador; aquí solo llegan ids públicos.
const Body = z.object({
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[\w.\-]{1,60}$/),
        ext: z.string().max(40).optional(),
        lang: z.enum(["EN", "JP"]).optional(),
        variant: z.string().min(1).max(80),
        keys: z.array(z.string().regex(/^[a-z]{2,4}[\d.]{1,4}$|^raw$/)).min(1).max(8),
      }),
    )
    .max(100),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!rateLimit(`pf:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "30" } });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const sources = new Map<string, SeriesSource>();
  const series: Record<string, { rows: Row[]; currency: string } | null> = {};
  // De 6 en 6 para no saturar el catálogo si hay cartas que aún no están en la caché.
  const items = parsed.data.items;
  for (let i = 0; i < items.length; i += 6) {
    await Promise.all(
      items.slice(i, i + 6).map(async (it) => {
        const k = `${it.id}|${it.variant}`;
        const card = await ensureCard(it.id, it.ext, it.lang);
        if (!card) return void (series[k] = null);
        try {
          const h = await getPriceHistory(card, it.variant);
          if (h.source) sources.set(`${h.source.id}|${h.source.raw?.label ?? ""}`, h.source);
          series[k] = h.points.length ? { rows: pointsToSeries(h.points, it.keys), currency: h.points[0].currency } : null;
        } catch {
          series[k] = null;
        }
      }),
    );
  }
  return NextResponse.json({ series, sources: [...sources.values()] });
}
