"use client";

import { useEffect, useMemo, useState } from "react";
import { seriesRequests, type SeriesMap } from "@/lib/portfolio/logic";
import { portfolioStore } from "@/lib/portfolio/store";
import type { Holding } from "@/lib/portfolio/types";
import { parseCsv } from "@/lib/prices/csv";
import { overrideRows, type ManualPrice } from "@/lib/prices/manual";
import { manualStore } from "@/lib/prices/manual-store";
import { pointsToSeries } from "@/lib/prices/series";
import type { Row, SeriesSource } from "@/lib/prices/types";

type Status = "loading" | "ready" | "error";
interface Prices {
  key: string; // peticiones a las que responde (si cambian los slabs, se descarta)
  status: "ready" | "error";
  series: SeriesMap;
  sources: SeriesSource[];
  csv: boolean; // alguna carta usa el CSV importado por el usuario
}

// CSV que el usuario importó en la ficha de la carta (misma clave que PriceContext): si existe, gana.
function localCsv(id: string, variant: string, keys: string[]): Row[] | null {
  try {
    const raw = localStorage.getItem(`slab:v2:csv:${id}|${variant}`);
    if (!raw) return null;
    const { text } = JSON.parse(raw) as { text: string };
    const rows = pointsToSeries(parseCsv(text, { cardId: id, variant, source: "csv" }).points, keys);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

// Slabs guardados en este navegador y las series de precio que necesitan: del servidor (una sola
// petición), o del CSV importado, con los precios puestos a mano encima.
export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [initialIds, setInitialIds] = useState<Set<string> | null>(null); // slabs que ya había al entrar
  const [storeError, setStoreError] = useState(false);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [tick, setTick] = useState(0);
  const [manual, setManual] = useState<ManualPrice[]>([]);

  // Precios puestos a mano (en la ficha o aquí mismo): se recargan cuando cambian
  useEffect(() => {
    let alive = true;
    const load = () =>
      manualStore
        .all()
        .then((m) => alive && setManual(m))
        .catch(() => {});
    void load();
    window.addEventListener("slab:prices", load);
    return () => {
      alive = false;
      window.removeEventListener("slab:prices", load);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      portfolioStore
        .list()
        .then((h) => {
          if (!alive) return;
          setHoldings(h);
          setInitialIds((prev) => prev ?? new Set(h.map((x) => x.id)));
        })
        .catch(() => alive && setStoreError(true));
    void load();
    window.addEventListener("slab:portfolio", load);
    return () => {
      alive = false;
      window.removeEventListener("slab:portfolio", load);
    };
  }, []);

  // Solo se vuelve a pedir si cambian las cartas, versiones o notas (no al editar un precio de compra).
  const requests = useMemo(() => (holdings ? seriesRequests(holdings) : []), [holdings]);
  const reqKey = JSON.stringify(requests) + tick;

  useEffect(() => {
    if (!holdings) return;
    const ctl = new AbortController();
    (async () => {
      const series: SeriesMap = new Map();
      let csv = false;
      const remote = requests.filter((r) => {
        const rows = localCsv(r.id, r.variant, r.keys);
        if (rows) {
          series.set(`${r.id}|${r.variant}`, rows);
          csv = true;
        }
        return !rows;
      });
      let sources: SeriesSource[] = [];
      if (remote.length) {
        try {
          const res = await fetch("/api/portfolio/prices", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: remote }),
            signal: ctl.signal,
          });
          if (!res.ok) throw new Error(String(res.status));
          const j = (await res.json()) as { series: Record<string, { rows: Row[] } | null>; sources: SeriesSource[] };
          for (const [k, v] of Object.entries(j.series)) if (v) series.set(k, v.rows);
          sources = j.sources;
        } catch {
          if (!ctl.signal.aborted) setPrices({ key: reqKey, status: "error", series, sources: [], csv });
          return;
        }
      }
      if (!ctl.signal.aborted) setPrices({ key: reqKey, status: "ready", series, sources, csv });
    })();
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reqKey resume requests y tick
  }, [reqKey, !holdings]);

  // Slabs añadidos durante esta visita: la vista los recibe con su revelado de la nota
  const fresh = useMemo(
    () => new Set((holdings ?? []).filter((h) => initialIds && !initialIds.has(h.id)).map((h) => h.id)),
    [holdings, initialIds],
  );

  const cur = prices && prices.key === reqKey ? prices : null;
  // Mientras llegan precios nuevos (p. ej. tras añadir un slab) se siguen enseñando los anteriores.
  const shown = cur ?? prices;
  const status: Status = !holdings ? "loading" : cur ? cur.status : "loading";

  // Encima de lo del servidor, los precios del usuario: en cada nota con precios suyos, mandan los suyos.
  const series = useMemo(() => {
    const base = shown?.series ?? new Map<string, Row[]>();
    if (!manual.length) return base;
    const out: SeriesMap = new Map(base);
    for (const r of requests) {
      const k = `${r.id}|${r.variant}`;
      const own = manual.filter((m) => m.cardId === r.id && m.variant === r.variant);
      if (own.length) out.set(k, overrideRows(base.get(k) ?? [], pointsToSeries(own, r.keys), r.keys));
    }
    return out;
  }, [shown, manual, requests]);
  const manualCount = useMemo(
    () => manual.filter((m) => requests.some((r) => r.id === m.cardId && r.variant === m.variant)).length,
    [manual, requests],
  );
  return {
    holdings,
    fresh,
    storeError,
    status,
    series,
    manualCount, // cuántos precios puestos a mano usa el portafolio
    sources: shown?.sources ?? [],
    csv: shown?.csv ?? false,
    retry: () => setTick((t) => t + 1),
  };
}
