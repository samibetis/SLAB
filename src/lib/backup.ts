// Copia de seguridad de lo que vive en el navegador (álbumes, slabs del portafolio y precios puestos a
// mano), para pasarla a otro navegador u otra dirección (de localhost a la web publicada) mientras no
// haya cuentas. Lógica pura: construir el archivo y validarlo al importar.

export const BACKUP_KIND = "slab-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_STORES = ["albums", "holdings", "prices"] as const;
export type BackupStore = (typeof BACKUP_STORES)[number];

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  data: Record<BackupStore, { id: string }[]>;
}

export function makeBackup(data: Partial<Record<BackupStore, { id: string }[]>>, now = new Date()): Backup {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: { albums: data.albums ?? [], holdings: data.holdings ?? [], prices: data.prices ?? [] },
  };
}

export const backupFileName = (now = new Date()) => `slab-copia-${now.toISOString().slice(0, 10)}.json`;

export type ParseResult = { ok: true; backup: Backup; counts: Record<BackupStore, number> } | { ok: false; error: "json" | "kind" | "version" };

// Valida un archivo importado. Solo se aceptan registros con id de texto; lo demás se descarta.
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "json" };
  }
  const b = raw as Partial<Backup> | null;
  if (!b || b.kind !== BACKUP_KIND || typeof b.data !== "object" || !b.data) return { ok: false, error: "kind" };
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) return { ok: false, error: "version" };
  const data = {} as Backup["data"];
  for (const s of BACKUP_STORES) {
    const list = Array.isArray(b.data[s]) ? b.data[s] : [];
    data[s] = list.filter((x): x is { id: string } => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" && (x as { id: string }).id.length > 0);
  }
  const backup: Backup = { kind: BACKUP_KIND, version: b.version, exportedAt: String(b.exportedAt ?? ""), data };
  return { ok: true, backup, counts: { albums: data.albums.length, holdings: data.holdings.length, prices: data.prices.length } };
}
