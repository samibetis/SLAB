import { notify, run } from "./browser-db";
import { BACKUP_STORES, makeBackup, type Backup } from "./backup";

// Navegador: leer todo para exportar y escribirlo al importar (añade o sustituye por id, no borra nada).

export async function exportAll(): Promise<Backup> {
  const data: Record<string, { id: string }[]> = {};
  for (const s of BACKUP_STORES) data[s] = await run<{ id: string }[]>(s, "readonly", (st) => st.getAll());
  return makeBackup(data);
}

export async function importAll(b: Backup): Promise<void> {
  for (const s of BACKUP_STORES) for (const item of b.data[s]) await run(s, "readwrite", (st) => st.put(item));
  // que se recarguen colección, portafolio y precios
  notify("slab:collection");
  notify("slab:portfolio");
  notify("slab:prices");
}
