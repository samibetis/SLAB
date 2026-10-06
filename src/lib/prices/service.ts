import type { Card } from "@/lib/cards/types";
import { getPricePoints } from "@/lib/db/prices-repo";
import { RAW_SOURCE_LABELS, anchorMock, isRawSource, realRaw } from "./merge";
import { MockProvider } from "./mock";
import { ensureSnapshot } from "./snapshot";
import type { PricePoint, SeriesSource } from "./types";

// Servidor: de dónde salen los precios públicos de una carta y versión.
//  1. Precio raw real: instantáneas diarias de TCGdex (TCGplayer en USD o, si no hay, Cardmarket en EUR)
//     guardadas en price_points. La de hoy se toma al consultar la carta si aún no existe.
//  2. Precios por nota: aún sin proveedor de pago. Los pone cada usuario a mano en su navegador (se
//     mezclan en el cliente, ver prices/manual.ts). Solo con PRICE_MOCK=1 se rellenan con datos
//     SINTÉTICOS escalados al raw real, para probar la interfaz.
//  3. Otras fuentes guardadas en price_points (el proveedor de pago, cuando llegue) se devuelven tal cual.
const mock = new MockProvider();
const PROVIDER_LABELS: Record<string, string> = { scrydex: "Scrydex" };

export interface PriceHistory {
  points: PricePoint[];
  source: SeriesSource | null;
}

// Los datos inventados ya no salen por defecto ni en desarrollo: la web se ve como en producción.
const mockAllowed = () => process.env.PRICE_MOCK === "1";

export async function getPriceHistory(
  card: Pick<Card, "id" | "name" | "rarity" | "year" | "language" | "externalIds" | "localId" | "set" | "variantOptions">,
  variant: string,
): Promise<PriceHistory> {
  await ensureSnapshot(card);
  let stored: PricePoint[] = [];
  try {
    stored = await getPricePoints(card.id, variant);
  } catch (e) {
    console.warn("[prices] lectura de base de datos:", e instanceof Error ? e.message : e);
  }

  const raw = realRaw(stored);
  const others = stored.filter((p) => !isRawSource(p.source));
  const rawInfo = raw.length
    ? { label: RAW_SOURCE_LABELS[raw.at(-1)!.source] ?? raw.at(-1)!.source, date: raw.at(-1)!.date, since: raw[0].date }
    : undefined;

  // Hay precios por nota de una fuente real: se devuelve todo lo guardado
  if (others.some((p) => p.grader !== "RAW")) {
    const ids = [...new Set(others.map((p) => p.source))];
    const label = ids.map((id) => PROVIDER_LABELS[id] ?? id).join(", ");
    return { points: [...raw, ...others], source: { id: ids[0], label, synthetic: false, raw: rawInfo } };
  }
  if (mockAllowed()) {
    const synthetic = await mock.getHistory({ card, variant });
    return {
      points: anchorMock(raw, synthetic),
      source: { id: mock.id, label: mock.label, synthetic: true, raw: rawInfo },
    };
  }
  if (raw.length) return { points: raw, source: { id: raw.at(-1)!.source, label: rawInfo!.label, synthetic: false, raw: rawInfo } };
  return { points: [], source: null };
}
