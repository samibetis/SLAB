import { isFreshCard, type Card, type CardLanguage } from "@/lib/cards/types";
import { getCardById, upsertCards } from "@/lib/db/cards-repo";
import { TcgdexProvider } from "./tcgdex";

const tcgdex = new TcgdexProvider();

// La carta guardada en la caché; si aún no está (enlaces desde un álbum o el portafolio) y llega su id
// de TCGdex, se pide al catálogo y se guarda. null si no existe o el id no cuadra.
// Si la guardada no está al día (p. ej. sin imagen), se intenta refrescar; si falla, vale la guardada.
export async function ensureCard(id: string, ext?: string | null, lang?: string | null): Promise<Card | null> {
  const cached = await getCardById(id).catch(() => null);
  if (cached && isFreshCard(cached)) return cached;
  ext ||= cached?.externalIds.tcgdex;
  lang ||= cached?.language;
  if (!ext || !/^[\w.\-]{1,40}$/.test(ext)) return cached;
  try {
    const card = await tcgdex.getCard({
      provider: "tcgdex", externalId: ext, language: (lang === "JP" ? "JP" : "EN") as CardLanguage, name: "", localId: "", hasImage: true,
    });
    if (!card || card.id !== id) return cached;
    await upsertCards([card]).catch(() => {});
    return card;
  } catch {
    return cached;
  }
}
