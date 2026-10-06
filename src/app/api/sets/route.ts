import { NextRequest, NextResponse } from "next/server";
import { getSets, matchSets } from "@/lib/catalog/sets";

export const runtime = "nodejs";
export const maxDuration = 60; // la primera vez se construye la lista de colecciones

// GET /api/sets?q=paldean  ó  ?q=PAF  -> colecciones que encajan (para crear un master set)
const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ sets: [] });
  try {
    const all = await getSets();
    const n = norm(q);
    // primero el código exacto, luego nombres que empiezan por la búsqueda, luego los que la contienen
    const byCode = matchSets(all, q);
    const starts = all.filter((s) => norm(s.name).startsWith(n));
    const contains = all.filter((s) => norm(s.name).includes(n));
    const seen = new Set<string>();
    const sets = [...byCode, ...starts, ...contains].filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true))).slice(0, 12);
    return NextResponse.json({ sets }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (e) {
    console.error("[api/sets]", e);
    return NextResponse.json({ error: "sets_unavailable" }, { status: 502 });
  }
}
