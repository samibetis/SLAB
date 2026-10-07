import { variantLabel } from "@/lib/cards/format";
import type { CardLanguage } from "@/lib/cards/types";
import { imagesForSet } from "@/lib/catalog/fallback-images";
import { getJson, mapLimit } from "@/lib/catalog/http";
import { buildCardId, formatNumber, variantOptions } from "@/lib/catalog/normalize";
import { getSets } from "@/lib/catalog/sets";
import type { SetInfo } from "@/lib/catalog/types";
import { listRankings, upsertRanking } from "@/lib/db/rankings-repo";
import type { RankedCard } from "@/lib/db/schema";
import { rawPricePoints, type PricingDetail } from "@/lib/prices/tcgdex-pricing";
import { RANKING_CURRENCY, RESCAN_DAYS, bestPrice, rankTop } from "./logic";

// Servidor: barrido de precios de colecciones enteras para los rankings. Por cada carta, su ficha de
// TCGdex (que trae el precio de mercado) y su versión más cara. Se guarda solo el top 10 de cada colección.

const API = "https://api.tcgdex.net/v2";
const LANG: Record<CardLanguage, string> = { EN: "en", JP: "ja" };

interface ListItem { id: string; localId: string; name: string; image?: string }
type Detail = PricingDetail & {
  set: { id: string; cardCount?: { official?: number } };
  variants_detailed?: { type?: string; subtype?: string; stamp?: string[]; thirdParty?: { tcgplayer?: number } }[];
};

export async function scanSet(set: SetInfo): Promise<{ cards: number; priced: number }> {
  const lang = LANG[set.language];
  const cfg = RANKING_CURRENCY[set.language];
  const today = new Date().toISOString().slice(0, 10);
  const list = await getJson<{ cards?: ListItem[] }>(`${API}/${lang}/sets/${encodeURIComponent(set.id)}`, { revalidate: 86400, timeoutMs: 15000 });
  const items = list.cards ?? [];

  const priced = (
    await mapLimit(items, 8, async (it): Promise<RankedCard | null> => {
      try {
        // sin caché: son miles de fichas y el precio cambia
        const d = await getJson<Detail>(`${API}/${lang}/cards/${encodeURIComponent(it.id)}`, { revalidate: 0, timeoutMs: 10000 });
        const id = buildCardId(set.language, d.set.id, String(it.localId));
        const best = bestPrice(rawPricePoints(id, d, today), cfg.currency);
        if (!best) return null;
        const option = variantOptions(d.variants_detailed, d.variants).find((o) => o.key === best.variant);
        return {
          id,
          externalId: it.id,
          name: it.name,
          localId: String(it.localId),
          number: formatNumber(String(it.localId), d.set.cardCount?.official),
          image: it.image ? `${it.image}/low.webp` : null,
          variant: best.variant,
          variantName: option ? variantLabel(option) : undefined,
          price: best.price,
        };
      } catch {
        return null; // una ficha que falla no tumba la colección
      }
    })
  ).filter((c): c is RankedCard => !!c);

  const top = rankTop(priced);
  // colección recién salida sin imágenes en TCGdex: las de respaldo (pokemontcg.io)
  if (set.language === "EN" && top.some((c) => !c.image)) {
    const imgs = await imagesForSet(
      { key: set.key, name: set.name, releaseDate: set.releaseDate, total: items.length },
      items.map((it) => ({ id: buildCardId("EN", set.id, String(it.localId)), name: it.name, localId: String(it.localId) })),
    );
    for (const c of top) c.image ??= imgs.get(c.id)?.small ?? null;
  }

  await upsertRanking({
    setKey: set.key, language: set.language, currency: cfg.currency, source: cfg.source,
    cardCount: items.length, pricedCount: priced.length, top,
  });
  return { cards: items.length, priced: priced.length };
}

// Barre las colecciones que tocan (sin ranking o con más de RESCAN_DAYS días), las que no se han hecho
// nunca primero, hasta agotar el tiempo. El cron diario lo llama: en una semana se recorren todas.
export async function scanStale(language: CardLanguage, budgetMs: number) {
  const deadline = Date.now() + budgetMs;
  const rows = await listRankings(language);
  const done = new Map(rows.map((r) => [r.setKey, r.scannedAt.getTime()]));
  // las que salieron sin ningún precio (colecciones recién salidas: TCGdex aún no los tiene) se
  // reintentan cada día en vez de cada semana
  const empty = new Set(rows.filter((r) => r.pricedCount === 0).map((r) => r.setKey));
  const due = (key: string) => (done.get(key) ?? 0) < Date.now() - (empty.has(key) ? 1 : RESCAN_DAYS) * 864e5 + 3600e3;
  const pending = (await getSets())
    .filter((s) => s.language === language && due(s.key))
    .sort((a, b) => (done.get(a.key) ?? 0) - (done.get(b.key) ?? 0) || (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  const scanned: { key: string; cards: number; priced: number }[] = [];
  const failed: string[] = [];
  for (const s of pending) {
    if (Date.now() > deadline) break;
    try {
      scanned.push({ key: s.key, ...(await scanSet(s)) });
    } catch (e) {
      failed.push(`${s.key}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { pending: pending.length, scanned, failed, left: pending.length - scanned.length - failed.length };
}
