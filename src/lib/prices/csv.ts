import { GRADES } from "./grades";
import type { PricePoint, PriceProvider, PriceQuery } from "./types";

// Importación de CSV con columnas fecha, raw, psa7, psa8, psa9, psa10 (el orden da igual; separador coma,
// punto y coma o tabulador). Fechas AAAA-MM o AAAA-MM-DD (también DD/MM/AAAA). Las filas del mismo mes
// se promedian más adelante, al construir la serie (series.ts).

const DATE_HEADERS = ["date", "fecha", "t", "month", "mes"];

// "2025-3" -> "2025-03-01"; "2025-03-14" -> "2025-03-14"; "14/03/2025" -> "2025-03-14"
export function normDate(raw: string): string | null {
  const s = (raw || "").replace(/["']/g, "").trim();
  let y: string, m: string, d = "1";
  let r = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  if (r) {
    [, y, m] = r;
    d = r[3] ?? "1";
  } else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) {
    [, d, m, y] = r;
  } else return null;
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Parte una línea por el separador respetando las comillas: "1,234.50" es un solo campo.
// Dentro de comillas, "" es una comilla literal.
export function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface CsvContext {
  cardId: string;
  variant: string;
  source: string;
  currency?: string;
}

export interface CsvResult {
  points: PricePoint[];
  rows: number; // filas de datos leídas
  skipped: number; // filas sin fecha válida
}

export function parseCsv(text: string, ctx: CsvContext): CsvResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { points: [], rows: 0, skipped: 0 };
  const h0 = lines[0];
  const sep = h0.includes("\t") ? "\t" : h0.split(";").length > h0.split(",").length ? ";" : ",";
  const head = splitLine(h0, sep)
    .map((h) => h.trim().toLowerCase().replace(/["'\s_-]/g, "").replace("ungraded", "raw").replace("grade", "psa"));
  const ti = head.findIndex((h) => DATE_HEADERS.includes(h));
  if (ti < 0) return { points: [], rows: 0, skipped: 0 };
  const cols = GRADES.map((g) => ({ g, i: head.indexOf(g.key) })).filter((c) => c.i >= 0);

  // Con ";" el decimal es la coma y el punto separa miles; en el resto, al revés.
  const num = (raw: string | undefined) => {
    if (!raw) return null;
    let s = raw.replace(/["\s$€]/g, "");
    if (!s) return null;
    s = sep === ";" ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    const v = parseFloat(s);
    return v > 0 ? v : null;
  };

  const points: PricePoint[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = splitLine(line, sep);
    const date = normDate(c[ti]);
    if (!date) {
      skipped++;
      continue;
    }
    for (const { g, i } of cols) {
      const price = num(c[i]);
      if (price)
        points.push({
          cardId: ctx.cardId, variant: ctx.variant, grader: g.grader, grade: g.grade,
          date, price, currency: ctx.currency ?? "USD", source: ctx.source,
        });
    }
  }
  return { points, rows: lines.length - 1, skipped };
}

// Proveedor con las ventas que aporta el propio usuario. Se usa en el navegador: los datos
// importados no se mezclan con los públicos del servidor.
export class CsvImportProvider implements PriceProvider {
  readonly id = "csv";
  readonly synthetic = false;
  readonly label: string;

  constructor(private text: string, private fileName: string) {
    this.label = `CSV importado (${fileName})`;
  }

  async getHistory(q: PriceQuery): Promise<PricePoint[]> {
    return parseCsv(this.text, { cardId: q.card.id, variant: q.variant, source: this.id }).points;
  }
}
