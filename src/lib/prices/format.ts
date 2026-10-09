import { LOCALES, type Lang } from "@/lib/i18n";

// Formato de números, precios y fechas según el idioma de la web. `formatters(lang)` da el juego entero;
// las funciones sueltas de abajo son las del español (para el servidor y los tests).

const MONTHS: Record<Lang, { short: string[]; long: string[] }> = {
  es: {
    short: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    long: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  },
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
};

export function formatters(lang: Lang) {
  const L = LOCALES[lang];
  const M = MONTHS[lang];

  const num1 = (v: number) => v.toLocaleString(L, { maximumFractionDigits: 1 });

  // +12%, -3,5%. null -> "—"
  const pct = (v: number | null | undefined) =>
    v == null
      ? "—"
      : (v > 0 ? "+" : "") + (v * 100).toLocaleString(L, { maximumFractionDigits: Math.abs(v) < 0.1 ? 1 : 0 }) + "%";

  function money(v: number | null | undefined, currency = "USD") {
    if (v == null || !isFinite(v)) return "—";
    try {
      return new Intl.NumberFormat(L, {
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
  function moneyCompact(v: number, currency = "USD") {
    const sym = ({ USD: "$", EUR: "€", JPY: "¥", GBP: "£" } as Record<string, string>)[currency] ?? "";
    const n =
      v >= 1e6
        ? num1(v / 1e6) + "M"
        : v >= 1e3
          ? num1(v / 1e3) + "k"
          : v.toLocaleString(L, { maximumFractionDigits: v < 10 ? 1 : 0 });
    return sym === "€" && lang === "es" ? n + " €" : sym + n;
  }

  // "2026-03" -> "mar 26" / "Mar 26"
  const monthShort = (t: string) => M.short[+t.slice(5, 7) - 1] + " " + t.slice(2, 4);

  // "2026-10-04" -> "4 de octubre de 2026" / "October 4, 2026"
  const dayLong = (d: string) => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
    const day = +d.slice(8, 10), month = M.long[+d.slice(5, 7) - 1], year = d.slice(0, 4);
    return lang === "es" ? `${day} de ${month} de ${year}` : `${month} ${day}, ${year}`;
  };

  // "2026-03" -> "marzo de 2026" / "March 2026"
  const monthLong = (t?: string | null) => {
    if (!t || !/^\d{4}-\d{2}/.test(t)) return lang === "es" ? "fecha sin indicar" : "date not given";
    const month = M.long[+t.slice(5, 7) - 1];
    return lang === "es" ? `${month} de ${t.slice(0, 4)}` : `${month} ${t.slice(0, 4)}`;
  };

  // "2026-03-04" -> "4 mar 2026" / "Mar 4, 2026"
  const dayShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(L, { day: "numeric", month: "short", year: "numeric" });

  return { num1, pct, money, moneyCompact, monthShort, dayLong, monthLong, dayShort };
}

export type Formatters = ReturnType<typeof formatters>;

export const { num1, pct, money, moneyCompact, monthShort, dayLong, monthLong } = formatters("es");
