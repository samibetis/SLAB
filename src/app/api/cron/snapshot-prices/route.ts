import { NextRequest, NextResponse } from "next/server";
import { mapLimit } from "@/lib/catalog/http";
import { cardsWithoutSnapshot } from "@/lib/db/prices-repo";
import { snapshotCard, today } from "@/lib/prices/snapshot";

export const runtime = "nodejs";
export const maxDuration = 300;

// Instantánea diaria del precio raw real (TCGdex) de las cartas guardadas que aún no la tienen hoy.
// Así el histórico crece aunque nadie consulte la carta. Cron diario (Vercel manda
// `Authorization: Bearer $CRON_SECRET`); en desarrollo, sin CRON_SECRET, se puede llamar a mano:
// GET /api/cron/snapshot-prices?limit=50
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new NextResponse("unauthorized", { status: 401 });
  }
  // Todas las pendientes de una vez (una petición barata por carta): así las cartas que TCGdex no tiene
  // con precio, y que siguen "pendientes" cada día, no dejan sin turno a las demás.
  const limit = Math.min(5000, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 3000));
  try {
    const pending = await cardsWithoutSnapshot(today(), limit);
    let points = 0;
    let failed = 0;
    const errors = new Set<string>(); // muestra de los motivos (para el registro del cron)
    await mapLimit(pending, 8, async (c) => {
      try {
        // primero esperar y luego sumar: `points += await …` lee `points` antes de esperar y, con
        // varias en paralelo, se pierden sumas
        const n = await snapshotCard(c, { force: true });
        points += n;
      } catch (e) {
        failed++;
        if (errors.size < 3) errors.add(e instanceof Error ? e.message : String(e));
      }
    });
    return NextResponse.json({ day: today(), cards: pending.length, points, failed, errors: [...errors] });
  } catch (e) {
    console.error("[cron/snapshot-prices]", e);
    return NextResponse.json({ error: "snapshot_failed" }, { status: 502 });
  }
}
