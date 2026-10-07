import { DEFAULT_VARIANT, type VariantOption } from "@/lib/cards/types";
import type { Album, AlbumCard, AlbumEntry, AlbumStats, SetCard, Tracking } from "./types";

// Versiones en un master set: qué versiones cuenta según el tipo elegido, cuáles tienes y el progreso.
// Todas las versiones de una carta comparten bolsillo; en un álbum libre cada versión es su propia entrada.

// Tipos de master set que ofrece la interfaz.
export const PRESETS = {
  cards: { reverse: false, special: false }, // una copia de cada carta, sirve cualquier versión
  reverse: { reverse: true, special: false }, // cada carta y su reverse holo
  all: { reverse: true, special: true }, // todas: sellos, 1ª edición, shadowless...
} satisfies Record<string, Tracking>;
export type Preset = keyof typeof PRESETS;

export const presetOf = (t?: Tracking): Preset => (!t || (!t.reverse && !t.special) ? "cards" : t.special ? "all" : "reverse");
export const countsVersions = (t?: Tracking) => presetOf(t) !== "cards";

export type VersionKind = "base" | "reverse" | "special";

// Base: la impresión normal o holo (unlimited incluida). Reverse: reverse holo sin nada más.
// Especial: lleva sello o un subtipo distinto de unlimited (shadowless, 1ª edición, copyright...).
// Esta es la clasificación "en abstracto"; dentro de una carta manda kindIn (relativa a su base).
export function versionKind(o: VariantOption): VersionKind {
  if (o.stamps?.length || (o.subtype && o.subtype !== "unlimited")) return "special";
  return o.type === "reverse" ? "reverse" : "base";
}

const STANDARD: VariantOption = { key: DEFAULT_VARIANT, type: "normal" };
const optionsOf = (c: SetCard): VariantOption[] => (c.variants?.length ? c.variants : [STANDARD]);

// Lo que distingue una versión aparte de si es holo/reverse: subtipo (sin "unlimited") y sellos.
const extras = (o: VariantOption) => [o.subtype === "unlimited" ? undefined : o.subtype, ...(o.stamps ?? [])].filter(Boolean).join("-");

// La versión base de la carta: la primera normal/holo sin extras; si no hay ninguna (en colecciones como
// la 30th Celebration TODAS las cartas llevan el sello del aniversario), la primera que no sea reverse.
function baseOption(opts: VariantOption[]): VariantOption {
  return opts.find((o) => versionKind(o) === "base") ?? opts.find((o) => o.type !== "reverse") ?? opts[0];
}

// La versión que representa a la carta cuando no se dice cuál (entradas antiguas, "solo cartas").
export function baseKey(c: SetCard): string {
  return baseOption(optionsOf(c)).key;
}

// Tipo de una versión DENTRO de su carta: con los mismos extras que la base, normal/holo o reverse;
// con extras distintos (otro sello, 1ª edición...), especial. Así un sello que llevan todas las cartas
// de la colección no convierte la carta entera en "especial".
export function kindIn(c: SetCard, o: VariantOption): VersionKind {
  const base = baseOption(optionsOf(c));
  if (extras(o) !== extras(base)) return "special";
  return o.type === "reverse" ? "reverse" : "base";
}

// Versiones que cuentan para el progreso de esta carta. En "solo cartas", una: la base.
export function trackedVersions(c: SetCard, t?: Tracking): VariantOption[] {
  const opts = optionsOf(c);
  if (!countsVersions(t)) return [baseOption(opts)];
  const out = opts.filter((o) => {
    const k = kindIn(c, o);
    return k === "base" || (k === "reverse" && t!.reverse) || (k === "special" && t!.special);
  });
  return out.length ? out : [baseOption(opts)];
}

const entriesOf = (album: Album, cardId: string) => album.entries.filter((e) => e.card.id === cardId);
// La versión de una entrada. Sin versión (entradas antiguas) o con una que la carta ya no tiene (p. ej.
// "standard", si se marcó antes de que llegaran sus versiones), cuenta como la base.
const entryKey = (e: AlbumEntry, c: SetCard) =>
  e.variant && optionsOf(c).some((o) => o.key === e.variant) ? e.variant : baseKey(c);

// Claves de las versiones que tienes de esta carta.
export const ownedKeys = (album: Album, c: SetCard) => new Set(entriesOf(album, c.id).map((e) => entryKey(e, c)));

export interface CardStatus {
  tracked: VariantOption[];
  owned: Set<string>; // versiones que tienes (cuenten o no)
  have: number; // de las que cuentan, cuántas tienes
  any: boolean; // tienes alguna versión
  complete: boolean;
}

export function cardStatus(album: Album, c: SetCard): CardStatus {
  const tracked = trackedVersions(c, album.tracking);
  const owned = ownedKeys(album, c);
  const any = owned.size > 0;
  // en "solo cartas" vale cualquier versión
  const have = countsVersions(album.tracking) ? tracked.filter((o) => owned.has(o.key)).length : any ? 1 : 0;
  return { tracked, owned, have, any, complete: have === tracked.length };
}

export interface VersionProgress extends AlbumStats {
  ratio: number;
  cards: { owned: number; total: number }; // cartas con alguna versión / cartas de la colección
}

// Progreso del master set. La unidad depende del tipo: cartas o versiones.
export function setProgress(album: Album, setCards: SetCard[]): VersionProgress {
  let owned = 0;
  let total = 0;
  let cardsOwned = 0;
  for (const c of setCards) {
    const s = cardStatus(album, c);
    owned += s.have;
    total += s.tracked.length;
    if (s.any) cardsOwned++;
  }
  return {
    owned, total, ratio: total ? owned / total : 0,
    unit: countsVersions(album.tracking) ? "versions" : "cards",
    cards: { owned: cardsOwned, total: setCards.length },
  };
}

const stripCard = (c: SetCard): AlbumCard => {
  const { variants: _v, ...card } = c;
  void _v;
  return card;
};

// Marca o desmarca una versión concreta. Desmarcar la base también quita las entradas antiguas sin versión.
export function toggleVersion(album: Album, c: SetCard, key: string, now = new Date()): Album {
  const has = ownedKeys(album, c).has(key);
  const entries = has
    ? album.entries.filter((e) => e.card.id !== c.id || entryKey(e, c) !== key)
    : [...album.entries, { card: stripCard(c), variant: key, addedAt: now.toISOString() }];
  return { ...album, entries, updatedAt: now.toISOString() };
}

// Un toque en el bolsillo cuando solo cuenta una versión: si tienes alguna, las quita todas; si no,
// marca la base.
export function toggleWhole(album: Album, c: SetCard, now = new Date()): Album {
  if (ownedKeys(album, c).size) {
    return { ...album, entries: album.entries.filter((e) => e.card.id !== c.id), updatedAt: now.toISOString() };
  }
  return toggleVersion(album, c, baseKey(c), now);
}

// Marca (sin desmarcar) una versión: "Añadir a un álbum" desde la ficha en un master set.
export function markVersion(album: Album, c: SetCard, key: string, now = new Date()): Album {
  return ownedKeys(album, c).has(key) ? album : toggleVersion(album, c, key, now);
}
