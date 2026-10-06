// Forma mínima de carta que necesita la UI y el visor 3D.
export type CardLanguage = "EN" | "JP";

export interface CardSummary {
  name: string;
  set?: string; // nombre de la colección
  number?: string; // para mostrar: "4/102"
  year?: number;
  language?: CardLanguage | string;
  edition?: string;
  rarity?: string;
  type?: string; // fire, water, grass... (clave de la paleta del visor)
}

// Una versión concreta de la carta: unlimited, shadowless, 1ª edición, reverse holo... Cada una
// tiene su propio precio, así que el usuario elige una (opción A del Hito 3).
export interface VariantOption {
  key: string; // "holo-shadowless-1st-edition"
  type: string; // normal | holo | reverse | ...
  subtype?: string; // unlimited | shadowless | 1999-2000-copyright
  stamps?: string[]; // 1st-edition, pokemon-together...
  tcgplayerId?: number; // producto de TCGplayer: su foto muestra esta versión concreta
}

// Versión del formato de la carta guardada. Si sube, las filas antiguas de la caché se vuelven a pedir.
// 2: ids de TCGplayer por versión (imagen de cada versión).
// 3: imagen de respaldo de pokemontcg.io cuando TCGdex aún no la tiene (colecciones recién salidas).
export const DETAIL_VERSION = 3;

// ¿La carta guardada está al día? Formato actual, versiones consultadas y, en inglés, con imagen: una
// carta guardada sin imagen (colección recién salida, o el respaldo falló ese día) se vuelve a pedir
// para intentar la imagen de respaldo. Las japonesas no tienen respaldo, así que no se reintentan.
export const isFreshCard = (c: Pick<Card, "variantOptions" | "detailVersion" | "imageUrl" | "language">) =>
  c.variantOptions !== null && (c.detailVersion ?? 1) >= DETAIL_VERSION && (c.imageUrl !== null || c.language !== "EN");

// Variante que se usa cuando la carta no declara ninguna.
export const DEFAULT_VARIANT = "standard";

// Carta normalizada: es lo que devuelve el catálogo, se guarda en base de datos y viaja a la UI.
export interface Card extends CardSummary {
  id: string; // id propio: "en-base1-4", "jp-sv2a-006"
  slug: string; // para /carta/[slug]
  setId: string;
  localId: string; // número dentro de la colección, tal cual: "4", "006", "CC008"
  language: CardLanguage;
  imageUrl: string | null; // alta resolución, la que usa el visor 3D
  imageThumbUrl: string | null; // miniatura para el buscador
  // Algunas imágenes se sirven sin CORS y WebGL no puede leerlas: hay que pasar por nuestro proxy.
  imageNeedsProxy: boolean;
  externalIds: Record<string, string>; // proveedor -> id externo
  variants: Record<string, boolean> | null; // normal, holo, reverse, firstEdition...
  variantOptions: VariantOption[] | null; // null = aún sin consultar (fila antigua); [] = sin variantes conocidas
  releaseDate?: string; // fecha de salida de la colección, "1999-01-09"; decide el reverso
  detailVersion?: number; // ver DETAIL_VERSION
}
