// IndexedDB del navegador, compartida por la colección y el portafolio. Una base "slab" con un
// almacén por tipo de dato. Al añadir un almacén nuevo sube VERSION y onupgradeneeded crea los que falten
// (los datos de los que ya existían se conservan).

const DB = "slab";
const VERSION = 3; // 1: albums · 2: holdings · 3: prices (precios puestos a mano)
export const STORES = ["albums", "holdings", "prices"] as const;
export type StoreName = (typeof STORES)[number];

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Ejecuta una operación sobre un almacén y devuelve su resultado como promesa.
export async function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

// Avisa a los demás componentes de que algo cambió ("slab:collection", "slab:portfolio").
export const notify = (event: string) => {
  try {
    window.dispatchEvent(new Event(event));
  } catch {}
};
