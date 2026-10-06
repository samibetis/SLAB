import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_VARIANT } from "@/lib/cards/types";
import { getCardById } from "@/lib/db/cards-repo";
import { getPriceHistory } from "@/lib/prices/service";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// GET /api/cards/en-base1-4/prices?variant=holo-shadowless
// -> { points: PricePoint[], source: { id, label, synthetic } | null }
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!rateLimit(`p:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "30" } });
  }
  const { id } = await ctx.params;
  const variant = (req.nextUrl.searchParams.get("variant") ?? DEFAULT_VARIANT).slice(0, 80);

  // La carta se conoce porque el buscador la guardó antes; los precios cuelgan de ella.
  const card = await getCardById(id).catch(() => null);
  if (!card) return NextResponse.json({ error: "card_not_found" }, { status: 404 });

  try {
    const history = await getPriceHistory(card, variant);
    return NextResponse.json(history, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[api/cards/prices]", e);
    return NextResponse.json({ error: "prices_unavailable" }, { status: 502 });
  }
}
