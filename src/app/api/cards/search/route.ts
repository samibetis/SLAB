import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/catalog/service";
import { rateLimit } from "@/lib/rate-limit";
import type { CardLanguage } from "@/lib/cards/types";

export const runtime = "nodejs";
// La primera búsqueda con un código de colección construye la lista de colecciones (~10 s, una sola vez).
export const maxDuration = 60;

// GET /api/cards/search?q=charizard%20base%20set&lang=EN|JP (sin lang: los dos)
// También entiende códigos de colección: "PAF", "charizard PAF", "PAF 54".
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!rateLimit(ip, 40, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "30" } });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 80) return NextResponse.json({ cards: [], matchedSet: null });

  const lang = req.nextUrl.searchParams.get("lang");
  const languages: CardLanguage[] | undefined = lang === "EN" || lang === "JP" ? [lang] : undefined;

  try {
    const requireSet = req.nextUrl.searchParams.get("set") === "1";
    const result = await searchCards(q, { languages, signal: req.signal, requireSet });
    return NextResponse.json(
      result, // { cards, matchedSet }
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("[api/cards/search]", e);
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 502 });
  }
}
