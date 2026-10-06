import { NextRequest, NextResponse } from "next/server";
import { sharesProduct, variantPhoto } from "@/lib/cards/variants";
import { pickVariantProduct, searchTcgplayer, tcgplayerImage, variantPhotosEnabled } from "@/lib/catalog/tcgplayer";
import { getCardById } from "@/lib/db/cards-repo";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// GET /api/cards/en-sv03.5-025/variant-photo?variant=normal-pokemon-together
// -> { url, productName } con la foto real de esa versión (o url: null si no hay o está desactivado).
// SOLO DEMOSTRACIÓN: fotos de TCGplayer sin acuerdo de uso (ver src/lib/catalog/tcgplayer.ts).

const memo = new Map<string, { at: number; body: { url: string | null; productName?: string } }>();
const DAY = 864e5;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!variantPhotosEnabled()) return NextResponse.json({ url: null, reason: "disabled" });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!rateLimit(`vp:${ip}`, 60, 60_000)) return NextResponse.json({ url: null }, { status: 429 });

  const { id } = await ctx.params;
  const variant = req.nextUrl.searchParams.get("variant") ?? "";
  const key = `${id}|${variant}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < DAY) return NextResponse.json(hit.body);

  const card = await getCardById(id).catch(() => null);
  const options = card?.variantOptions ?? [];
  const option = options.find((o) => o.key === variant);
  // la versión principal usa la imagen principal de la carta
  if (!card || !option || option.key === options[0]?.key) return NextResponse.json({ url: null });

  let body: { url: string | null; productName?: string } = { url: null };
  // 1. TCGdex ya da un producto de TCGplayer propio para esta versión
  const direct = variantPhoto(options, option);
  if (direct) body = { url: direct };
  // 2. Si no (sellos, sobre todo), se busca el producto por nombre y número. Salvo si su producto es
  //    compartido con otra versión (shadowless y 1ª edición de Base Set): la búsqueda daría la misma foto.
  else if (card.language === "EN" && !sharesProduct(options, option)) {
    try {
      const products = await searchTcgplayer(`${card.name} ${card.localId}`, req.signal);
      const p = pickVariantProduct(products, card, option);
      if (p) body = { url: tcgplayerImage(p.productId), productName: p.productName };
    } catch (e) {
      console.warn("[variant-photo]", e instanceof Error ? e.message : e);
      return NextResponse.json({ url: null }); // sin guardar en memoria: se reintenta la próxima vez
    }
  }
  if (memo.size > 2000) memo.clear();
  memo.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
