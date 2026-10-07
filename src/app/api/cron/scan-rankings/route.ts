import { NextRequest, NextResponse } from "next/server";
import { getSets } from "@/lib/catalog/sets";
import { RANKING_LANGUAGES } from "@/lib/rankings/logic";
import { scanSet, scanStale } from "@/lib/rankings/scan";

export const runtime = "nodejs";
export const maxDuration = 300;

// Barrido de precios para los rankings de colecciones. Cron diario: cada día recorre las colecciones
// que tocan durante ~4 minutos, así que en una semana se actualizan todas.
// En desarrollo (sin CRON_SECRET) se puede llamar a mano:
//   GET /api/cron/scan-rankings              -> las que tocan, hasta agotar el tiempo
//   GET /api/cron/scan-rankings?budget=60    -> segundos de trabajo
//   GET /api/cron/scan-rankings?set=en-sv04.5 -> solo esa colección
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new NextResponse("unauthorized", { status: 401 });
  }
  try {
    const one = req.nextUrl.searchParams.get("set");
    if (one) {
      const set = (await getSets()).find((s) => s.key === one.toLowerCase());
      if (!set) return NextResponse.json({ error: "set_not_found" }, { status: 404 });
      return NextResponse.json({ set: set.key, ...(await scanSet(set)) });
    }
    const budget = Math.min(270, Math.max(10, Number(req.nextUrl.searchParams.get("budget")) || 240)) * 1000;
    const out = [];
    for (const lang of RANKING_LANGUAGES) out.push({ language: lang, ...(await scanStale(lang, budget / RANKING_LANGUAGES.length)) });
    return NextResponse.json(out);
  } catch (e) {
    console.error("[cron/scan-rankings]", e);
    return NextResponse.json({ error: "scan_failed" }, { status: 502 });
  }
}
