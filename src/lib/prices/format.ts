// Formato de números y precios. Locale es-ES fijo por ahora (los textos se traducirán más adelante).
const LOCALE = "es-ES";

export const num1 = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

// +12%, -3,5%. null -> "—"
export const pct = (v: number | null | undefined) =>
  v == null
    ? "—"
    : (v > 0 ? "+" : "") + (v * 100).toLocaleString(LOCALE, { maximumFractionDigits: Math.abs(v) < 0.1 ? 1 : 0 }) + "%";

export function money(v: number | null | undefined, currency = "USD") {
  if (v == null || !isFinite(v)) return "—";
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: v < 100 ? 2 : 0,
    }).format(v);
  } catch {
    return Math.round(v) + " " + currency;
  }
}

// Compacto para los ejes: 1,2k, 3M
export function moneyCompact(v: number, currency = "USD") {
  const sym = ({ USD: "$", EUR: "€", JPY: "¥", GBP: "£" } as Record<string, string>)[currency] ?? "";
  const n =
    v >= 1e6
      ? num1(v / 1e6) + "M"
      : v >= 1e3
        ? num1(v / 1e3) + "k"
        : v.toLocaleString(LOCALE, { maximumFractionDigits: v < 10 ? 1 : 0 });
  return sym === "€" ? n + " €" : sym + n;
}

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const monthShort = (t: string) => MES[+t.slice(5, 7) - 1] + " " + t.slice(2, 4); // "mar 26"
// "2026-10-04" -> "4 de octubre de 2026"
export const dayLong = (d: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(d) ? `${+d.slice(8, 10)} de ${MESL[+d.slice(5, 7) - 1]} de ${d.slice(0, 4)}` : d;
export const monthLong = (t?: string | null) =>
  t && /^\d{4}-\d{2}/.test(t) ? MESL[+t.slice(5, 7) - 1] + " de " + t.slice(0, 4) : "fecha sin indicar";
