import { notify, run } from "@/lib/browser-db";
import type { Album } from "./types";

// Dónde se guarda la colección. Hoy, IndexedDB del navegador; mañana, una implementación que sincronice
// con el servidor (cuentas, app móvil) con la misma interfaz.
export interface CollectionStore {
  list(): Promise<Album[]>;
  get(id: string): Promise<Album | null>;
  save(album: Album): Promise<void>;
  remove(id: string): Promise<void>;
}

export const browserStore: CollectionStore = {
  list: async () => (await run<Album[]>("albums", "readonly", (s) => s.getAll())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  get: async (id) => (await run<Album | undefined>("albums", "readonly", (s) => s.get(id))) ?? null,
  save: async (album) => {
    await run("albums", "readwrite", (s) => s.put(album));
    notify("slab:collection");
  },
  remove: async (id) => {
    await run("albums", "readwrite", (s) => s.delete(id));
    notify("slab:collection");
  },
};
