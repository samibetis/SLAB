// Límite de peticiones por clave (IP) en memoria. Basta para frenar abusos simples; en Vercel cada
// instancia tiene su propio contador, así que no es un límite global estricto.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length <= max;
}
