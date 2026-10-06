import { notify, run } from "@/lib/browser-db";
import { manualPrefix, type ManualPrice } from "./manual";

// Precios puestos a mano, en la IndexedDB del navegador (almacén "prices"). Avisa con "slab:prices"
// para que la ficha, la gráfica y el portafolio se recalculen.
export const manualStore = {
  // Los de una carta y versión (las claves empiezan por "<carta>|<versión>|")
  forCard: (cardId: string, variant: string) => {
    const p = manualPrefix(cardId, variant);
    return run<ManualPrice[]>("prices", "readonly", (s) => s.getAll(IDBKeyRange.bound(p, `${p}￿`)));
  },
  all: () => run<ManualPrice[]>("prices", "readonly", (s) => s.getAll()),
  save: async (m: ManualPrice) => {
    await run("prices", "readwrite", (s) => s.put(m));
    notify("slab:prices");
  },
  remove: async (id: string) => {
    await run("prices", "readwrite", (s) => s.delete(id));
    notify("slab:prices");
  },
};
