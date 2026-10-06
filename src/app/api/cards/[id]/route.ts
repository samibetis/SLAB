import { NextRequest, NextResponse } from "next/server";
import { ensureCard } from "@/lib/catalog/ensure";

export const runtime = "nodejs";

// GET /api/cards/en-base1-4 -> la carta guardada (para abrirla desde un enlace: /?card=en-base1-4).
// Si aún no está en la caché (p. ej. desde un álbum) y llegan ?ext=<id de TCGdex>&lang=EN|JP, se pide
// al catálogo y se guarda.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const card = await ensureCard(id, sp.get("ext"), sp.get("lang"));
  if (!card) return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  return NextResponse.json(card, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
