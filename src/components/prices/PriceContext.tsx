"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { slugify } from "@/lib/catalog/normalize";
import { DEFAULT_VARIANT, type Card, type VariantOption } from "@/lib/cards/types";
import { es } from "@/lib/i18n/es";
import { parseCsv } from "@/lib/prices/csv";
import { DEFAULT_GRADER, carryGrade, type GraderId } from "@/lib/grading/companies";
import { gradesFor, type GradeDef } from "@/lib/prices/grades";
import { DEFAULT_RANGE, type RangeKey } from "@/lib/prices/ranges";
import { makeManual, mergeManual, type ManualPrice } from "@/lib/prices/manual";
import { manualStore } from "@/lib/prices/manual-store";
import { lastMonth, pointsToSeries } from "@/lib/prices/series";
import type { PricePoint, Row, SeriesSource } from "@/lib/prices/types";
import { useCard } from "../CardContext";

// Todo el estado de la zona de precios: versión elegida, periodo, grados visibles, escala, y la serie
// (del servidor, o del CSV que haya importado el usuario) con los precios que el usuario ha puesto a mano
// encima. La leen las casillas, la gráfica y el analizador.

type Status = "idle" | "loading" | "ready" | "error";
interface Loaded {
  key: string;
  status: "ready" | "error";
  points: PricePoint[];
  source: SeriesSource | null;
  error?: string;
}

interface PriceCtx {
  variants: VariantOption[];
  variant: string;
  setVariant: (key: string) => void;
  presetVariant: (cardId: string, key: string) => void; // antes de que la carta esté cargada (enlaces)
  grader: GraderId; // empresa de gradeo elegida (la comparten el visor y los precios)
  setGrader: (g: GraderId) => void; // conserva la nota si existe en la nueva escala
  gradeId: string; // nota de la funda del visor ("10", "9.5", "p10"); la usa también "Añadir al portafolio"
  setGradeId: (id: string) => void;
  grades: GradeDef[]; // raw + las notas con precio de esa empresa
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  visible: Set<string>;
  toggleGrade: (key: string) => void;
  log: boolean;
  setLog: (v: boolean) => void;
  status: Status;
  rows: Row[]; // serie mensual completa (el periodo se recorta al pintar)
  currency: string;
  source: SeriesSource | null;
  asOf: string | null;
  notice: string | null; // aviso del último CSV (inválido, filas ignoradas)
  manual: ManualPrice[]; // precios puestos a mano para esta carta y versión
  addManual: (p: { grader: string; grade: number | null; price: number; date: string; note?: string }) => Promise<void>;
  removeManual: (id: string) => Promise<void>;
  pickCsv: () => void;
  removeCsv: () => void;
  retry: () => void;
}

const Ctx = createContext<PriceCtx | null>(null);
export const usePrices = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrices fuera de PriceProvider");
  return c;
};

// El CSV importado se queda en el navegador de quien lo importa, por carta y versión.
const csvKey = (key: string) => `slab:v2:csv:${key}`;
const readCsv = (key: string): { file: string; text: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(csvKey(key)) ?? "null");
  } catch {
    return null;
  }
};
const writeCsv = (key: string, v: { file: string; text: string } | null) => {
  try {
    if (v) localStorage.setItem(csvKey(key), JSON.stringify(v));
    else localStorage.removeItem(csvKey(key));
  } catch {
    /* almacenamiento bloqueado: el CSV sirve solo para esta visita */
  }
};

// Carta provisional cuando se importa un CSV sin haber buscado ninguna (como el prototipo).
const csvCard = (file: string): Card => {
  const name = file.replace(/\.(csv|txt)$/i, "");
  const id = `csv-${slugify(name) || "datos"}`;
  return {
    id, slug: id, name, set: es.prices.csvCardName, setId: "csv", localId: "0", language: "EN",
    imageUrl: null, imageThumbUrl: null, imageNeedsProxy: false, externalIds: {}, variants: null, variantOptions: [],
  };
};

export function PriceProvider({ children }: { children: ReactNode }) {
  const { card, setCard } = useCard();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [grader, setGraderState] = useState<GraderId>(DEFAULT_GRADER);
  const [gradeId, setGradeId] = useState("10");
  // Se guardan los grados ocultos (no los visibles): al cambiar de empresa, sus notas salen visibles.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [log, setLog] = useState(true);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [tick, setTick] = useState(0); // sube para volver a cargar (reintentar, CSV nuevo o borrado)
  const [notice, setNotice] = useState<string | null>(null);
  const [manualLoaded, setManualLoaded] = useState<{ key: string; list: ManualPrice[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grades = useMemo(() => gradesFor(grader), [grader]);
  const visible = useMemo(() => new Set(grades.map((g) => g.key).filter((k) => !hidden.has(k))), [grades, hidden]);
  const variants = card?.variantOptions ?? [];
  const variant = (card && chosen[card.id]) || variants[0]?.key || DEFAULT_VARIANT;
  const key = card ? `${card.id}|${variant}` : null;

  // Carga: primero el CSV propio si existe, si no el servidor. Si cambia la carta mientras tanto, se descarta.
  useEffect(() => {
    if (!card || !key) return;
    const ctl = new AbortController();
    (async () => {
      const csv = readCsv(key);
      if (csv) {
        const { points } = parseCsv(csv.text, { cardId: card.id, variant, source: "csv" });
        if (!ctl.signal.aborted) {
          setLoaded({ key, status: "ready", points, source: { id: "csv", label: csv.file, synthetic: false, file: csv.file } });
        }
        return;
      }
      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(card.id)}/prices?variant=${encodeURIComponent(variant)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { points: PricePoint[]; source: SeriesSource | null };
        setLoaded({ key, status: "ready", points: j.points, source: j.source });
      } catch {
        if (!ctl.signal.aborted) setLoaded({ key, status: "error", points: [], source: null, error: es.prices.fetchError });
      }
    })();
    return () => ctl.abort();
  }, [card, key, variant, tick]);

  // Precios puestos a mano (del navegador). Se recargan si cambian en cualquier parte (portafolio, otra pestaña).
  useEffect(() => {
    if (!card || !key) return;
    let alive = true;
    const load = () =>
      manualStore
        .forCard(card.id, variant)
        .then((list) => alive && setManualLoaded({ key, list }))
        .catch(() => alive && setManualLoaded({ key, list: [] }));
    void load();
    window.addEventListener("slab:prices", load);
    return () => {
      alive = false;
      window.removeEventListener("slab:prices", load);
    };
  }, [card, key, variant]);
  const manual = useMemo(() => (manualLoaded && manualLoaded.key === key ? manualLoaded.list : []), [manualLoaded, key]);

  const cur = loaded && loaded.key === key ? loaded : null;
  const status: Status = !card ? "idle" : !cur ? "loading" : cur.status;
  const points = useMemo(() => (cur ? mergeManual(cur.points, manual) : []), [cur, manual]);
  const rows = useMemo(() => pointsToSeries(points), [points]);
  const currency = points[0]?.currency ?? "USD";

  const importFile = useCallback(
    async (file: File) => {
      const target = card ?? csvCard(file.name);
      const v = card ? variant : DEFAULT_VARIANT;
      const text = await file.text();
      const res = parseCsv(text, { cardId: target.id, variant: v, source: "csv" });
      if (!res.points.length) return setNotice(es.prices.csvInvalid);
      setNotice(res.skipped ? es.prices.csvSkipped(res.skipped) : null);
      writeCsv(`${target.id}|${v}`, { file: file.name, text });
      if (card) setTick((t) => t + 1);
      else setCard(target); // la carga lee el CSV recién guardado
    },
    [card, variant, setCard],
  );

  const value: PriceCtx = {
    variants,
    variant,
    setVariant: (k) => card && setChosen((c) => ({ ...c, [card.id]: k })),
    presetVariant: (id, k) => setChosen((c) => ({ ...c, [id]: k })),
    grader,
    setGrader: (g) => {
      setGradeId((id) => carryGrade(g, id));
      setGraderState(g);
    },
    gradeId,
    setGradeId,
    grades,
    range,
    setRange,
    visible,
    // al menos un grado siempre visible
    toggleGrade: (k) =>
      setHidden((h) => {
        const n = new Set(h);
        if (n.has(k)) n.delete(k);
        else if (visible.size > 1) n.add(k);
        return n;
      }),
    log,
    setLog,
    status,
    rows,
    currency,
    source: cur?.source ?? null,
    asOf: lastMonth(rows),
    notice,
    manual,
    addManual: async ({ grader, grade, price, date, note }) => {
      if (!card) return;
      await manualStore.save(makeManual({ cardId: card.id, variant, grader, grade, date, price, currency }, note));
    },
    removeManual: (id) => manualStore.remove(id),
    pickCsv: () => fileRef.current?.click(),
    removeCsv: () => {
      if (key) writeCsv(key, null);
      setNotice(null);
      setTick((t) => t + 1);
    },
    retry: () => setTick((t) => t + 1),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,.txt"
        className="vh"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
    </Ctx.Provider>
  );
}
