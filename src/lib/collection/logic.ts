import type { Album, AlbumCard, AlbumEntry } from "./types";

// Lógica pura de álbumes: orden, páginas de la carpeta, progreso y marcar/desmarcar. Sin navegador.

export const POCKETS = 9; // bolsillos por página (3 x 3, como una carpeta real)

// Orden de colección: por número; los que llevan letras ("TG05", "SV001") después, alfabéticos.
export function byNumber(a: Pick<AlbumCard, "localId">, b: Pick<AlbumCard, "localId">): number {
  const na = /^\d+$/.test(a.localId) ? parseInt(a.localId, 10) : NaN;
  const nb = /^\d+$/.test(b.localId) ? parseInt(b.localId, 10) : NaN;
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  if (!isNaN(na)) return -1;
  if (!isNaN(nb)) return 1;
  return a.localId.localeCompare(b.localId, "en", { numeric: true });
}

// Reparte en páginas de 9; la última se rellena con huecos (null) para que la rejilla no se descuadre.
export function paginate<T>(items: T[], size = POCKETS): (T | null)[][] {
  const pages: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += size) {
    const page: (T | null)[] = items.slice(i, i + size);
    while (page.length < size) page.push(null);
    pages.push(page);
  }
  return pages.length ? pages : [Array(size).fill(null)];
}

// Añade una carta a un álbum libre. Cada versión es una entrada propia: la reverse de una carta que ya
// tienes en normal ocupa otro bolsillo. Si esa misma versión ya estaba, solo se actualiza.
export function addCard(album: Album, card: AlbumCard, variant: string | undefined, now = new Date(), variantName?: string): Album {
  const rest = album.entries.filter((e) => !(e.card.id === card.id && e.variant === variant));
  return { ...album, entries: [...rest, { card, variant, variantName, addedAt: now.toISOString() }], updatedAt: now.toISOString() };
}

// Clave única de una entrada de álbum libre (carta + versión), para listas y bolsillos.
export const entryId = (e: Pick<AlbumEntry, "card" | "variant">) => `${e.card.id}|${e.variant ?? ""}`;

// ¿Pertenece la carta a la colección de este master set? (para proponer el álbum correcto al añadir)
export const belongsTo = (album: Album, cardId: string) =>
  album.kind === "master" && !!album.set && cardId.startsWith(`${album.set.key}-`);

// Imagen de TCGdex en el tamaño pedido.
export const cardImage = (c: Pick<AlbumCard, "image" | "thumb">, size: "low" | "high" = "low") =>
  c.image ? `${c.image}/${size}.webp` : (c.thumb ?? null);

// Enlace para abrir la carta en el visor y sus precios, aunque aún no esté en la caché del servidor.
export const cardHref = (c: Pick<AlbumCard, "id" | "externalId" | "language">, variant?: string) =>
  `/?card=${encodeURIComponent(c.id)}&ext=${encodeURIComponent(c.externalId)}&lang=${c.language}${
    variant ? `&variant=${encodeURIComponent(variant)}` : ""
  }`;

// De una carta del catálogo a la forma que guarda un álbum.
export function toAlbumCard(card: import("@/lib/cards/types").Card): AlbumCard {
  const tcgdexBase = card.imageUrl?.match(/^(https:\/\/assets\.tcgdex\.net\/.+)\/(?:high|low)\.\w+$/)?.[1] ?? null;
  return {
    id: card.id,
    externalId: card.externalIds.tcgdex ?? card.id.replace(/^(en|jp)-/, ""),
    name: card.name,
    localId: card.localId,
    number: card.number,
    setName: card.set,
    language: card.language,
    image: tcgdexBase,
    thumb: tcgdexBase ? null : card.imageThumbUrl,
  };
}

let counter = 0;
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
