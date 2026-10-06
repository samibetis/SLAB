import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxy de imágenes para hosts que no envían CORS (WebGL no puede leer una textura sin él).
// Solo sirve hosts de la lista y solo imágenes, para que no se pueda usar como proxy abierto.
// TCGplayer: fotos de cada versión concreta de la carta (1ª edición, shadowless...).
const ALLOWED = new Set(["images.pokemontcg.io", "images.scrydex.com", "assets.tcgdex.net", "tcgplayer-cdn.tcgplayer.com"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED.has(url.hostname)) return new NextResponse("host not allowed", { status: 400 });

  const up = await fetch(url, { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } }).catch(() => null);
  const type = up?.headers.get("content-type") ?? "";
  if (!up?.ok || !type.startsWith("image/")) return new NextResponse("upstream error", { status: 502 });
  const buf = await up.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new NextResponse("too large", { status: 502 });

  return new NextResponse(buf, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
