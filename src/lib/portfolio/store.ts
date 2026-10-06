import { notify, run } from "@/lib/browser-db";
import type { Holding } from "./types";

// Dónde se guarda el portafolio. Igual que la colección: hoy el navegador, mañana una cuenta.
export interface PortfolioStore {
  list(): Promise<Holding[]>;
  save(h: Holding): Promise<void>;
  remove(id: string): Promise<void>;
}

export const portfolioStore: PortfolioStore = {
  list: async () => (await run<Holding[]>("holdings", "readonly", (s) => s.getAll())).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  save: async (h) => {
    await run("holdings", "readwrite", (s) => s.put(h));
    notify("slab:portfolio");
  },
  remove: async (id) => {
    await run("holdings", "readwrite", (s) => s.delete(id));
    notify("slab:portfolio");
  },
};
