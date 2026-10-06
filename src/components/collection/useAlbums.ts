"use client";

import { useEffect, useState } from "react";
import { browserStore } from "@/lib/collection/store";
import type { Album } from "@/lib/collection/types";

// Álbumes guardados en este navegador; se recargan solos cuando algo los cambia (en cualquier componente).
export function useAlbums() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      browserStore
        .list()
        .then((a) => alive && setAlbums(a))
        .catch(() => alive && setError(true));
    void load();
    window.addEventListener("slab:collection", load);
    return () => {
      alive = false;
      window.removeEventListener("slab:collection", load);
    };
  }, []);
  return { albums, error };
}
