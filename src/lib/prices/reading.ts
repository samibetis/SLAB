import { es } from "@/lib/i18n/es";
import type { Dict } from "@/lib/i18n";
import type { Facts } from "./analyzer";
import { formatters, type Formatters } from "./format";

// Lectura automática en una o dos frases: mejor y peor grado, el más volátil y el múltiplo nota máxima / raw
// como margen teórico de gradear. `label` traduce la clave de grado a su nombre ("psa10" -> "PSA 10").
export function readingText(
  f: Facts, rangeName: string, label: (key: string) => string,
  d: Dict = es, { num1, pct }: Formatters = formatters("es"),
): string {
  const t = d.analysis;
  let s = t.readBest(label(f.best.key), pct(f.best.change), rangeName);
  if (f.worst.key !== f.best.key) s += t.readWorst(label(f.worst.key), pct(f.worst.change));
  s += t.readVol(label(f.mostVolatile.key), num1(f.mostVolatile.vol * 100));
  if (f.top) s += t.readGrade(label(f.top.key), num1(f.top.vsRaw));
  return s;
}
