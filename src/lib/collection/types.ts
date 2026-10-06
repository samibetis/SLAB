import type { CardLanguage, VariantOption } from "@/lib/cards/types";

// Colección del usuario. De momento se guarda en su navegador (IndexedDB); los tipos están pensados
// para sincronizar más adelante con cuentas (y la app móvil) sin cambiarlos.

// Lo mínimo de una carta para pintarla en un álbum sin volver a pedirla al catálogo.
export interface AlbumCard {
  id: string; // id propio: "en-sv04.5-054"
  externalId: string; // id en TCGdex ("sv04.5-054"): sirve para abrir la carta aunque no esté en la caché
  name: string;
  localId: string; // "054"
  number?: string; // "054/091"
  setName?: string;
  language: CardLanguage;
  image: string | null; // imagen base de TCGdex (sin "/low.webp")
  thumb?: string | null; // miniatura completa cuando la imagen no es de TCGdex
}

export interface AlbumEntry {
  card: AlbumCard;
  variant?: string; // versión concreta (clave de VariantOption). Sin ella, entradas antiguas: la versión base
  variantName?: string; // etiqueta legible guardada al añadir ("Reverse holo")
  addedAt: string; // ISO
}

// Qué cuenta un master set además de una copia de cada carta. Las dos a false: "solo cartas" (vale
// cualquier versión). reverse: también la reverse holo. special: también sellos, 1ª edición, shadowless...
export interface Tracking {
  reverse: boolean;
  special: boolean;
}

// Carta de una colección con sus versiones (lo que devuelve /api/sets/[key]/cards).
export interface SetCard extends AlbumCard {
  variants?: VariantOption[];
}

// Progreso guardado para la portada del álbum (se recalcula al abrirlo y al marcar).
export interface AlbumStats {
  owned: number;
  total: number;
  unit: "cards" | "versions";
}

export interface AlbumSet {
  key: string; // "en-sv04.5"
  id: string; // "sv04.5"
  language: CardLanguage;
  name: string;
  code: string | null;
}

export interface Album {
  id: string;
  name: string;
  kind: "master" | "free"; // master set de una colección, o álbum libre
  set?: AlbumSet; // solo en master sets
  entries: AlbumEntry[]; // cartas que tienes (en un master set, las marcadas)
  total?: number; // master set: cartas de la colección (se guarda al abrirlo, para la portada)
  tracking?: Tracking; // master set: qué versiones cuentan (sin él, álbumes antiguos: solo cartas)
  stats?: AlbumStats; // master set: progreso para la portada
  createdAt: string;
  updatedAt: string;
}
