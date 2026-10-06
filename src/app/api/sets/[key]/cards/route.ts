import { NextRequest, NextResponse } from "next/server";
import { imagesForSet } from "@/lib/catalog/fallback-images";
import { listSetDetailed } from "@/lib/catalog/service";
import { getSets } from "@/lib/catalog/sets";
import { byNumber } from "@/lib/collection/logic";
import type { SetCard } from "@/lib/collection/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/sets/en-sv04.5/cards -> la colección y todas sus cartas en orden, cada una con sus
// versiones (normal, reverse, sellos...) para el master set.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  try {
    const set = (await getSets()).find((s) => s.key === key.toLowerCase());
    if (!set) return NextResponse.json({ error: "set_not_found" }, { status: 404 });
    const { refs, cards: detail } = await listSetDetailed(set);
    const idOf = (r: (typeof refs)[number]) => `${r.language.toLowerCase()}-${r.externalId}`.toLowerCase();
    // Colección recién salida sin imágenes en TCGdex: miniaturas de respaldo (pokemontcg.io)
    const fallback =
      set.language === "EN" && refs.some((r) => !r.image)
        ? await imagesForSet({ key: set.key, name: set.name, releaseDate: set.releaseDate, total: refs.length }, refs.map((r) => ({ id: idOf(r), name: r.name, localId: r.localId })))
        : new Map();
    const cards: SetCard[] = refs
      .map((r) => {
        const id = idOf(r);
        const d = detail.get(id);
        return {
          id,
          externalId: r.externalId,
          name: r.name,
          localId: r.localId,
          number: d?.number,
          setName: set.name,
          language: r.language,
          image: r.image ?? null,
          thumb: r.image ? undefined : (fallback.get(id)?.small ?? d?.imageThumbUrl ?? null),
          variants: d?.variantOptions ?? [],
        };
      })
      .sort(byNumber);
    return NextResponse.json({ set, cards }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    console.error("[api/sets/cards]", e);
    return NextResponse.json({ error: "set_unavailable" }, { status: 502 });
  }
}
