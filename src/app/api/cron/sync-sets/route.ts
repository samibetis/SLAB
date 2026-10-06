import { NextRequest, NextResponse } from "next/server";
import { refreshSets } from "@/lib/catalog/sets";

export const runtime = "nodejs";
export const maxDuration = 60;

// Refresca la lista de colecciones y sus códigos (nuevas expansiones). Pensado para un cron diario
// (Vercel Cron manda `Authorization: Bearer $CRON_SECRET`). En desarrollo, sin CRON_SECRET, se puede
// llamar a mano: GET /api/cron/sync-sets
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new NextResponse("unauthorized", { status: 401 });
  }
  try {
    return NextResponse.json({ sets: await refreshSets() });
  } catch (e) {
    console.error("[cron/sync-sets]", e);
    return NextResponse.json({ error: "sync_failed" }, { status: 502 });
  }
}
