// fetch con tiempo máximo y cancelación, compartido por los proveedores.
export async function getJson<T>(
  url: string,
  opts: { signal?: AbortSignal; timeoutMs?: number; headers?: HeadersInit; revalidate?: number } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 8000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json", ...opts.headers },
    // caché de datos de Next en el servidor (las APIs externas mandan no-store)
    next: { revalidate: opts.revalidate ?? 3600 },
  });
  if (!res.ok) throw new Error(`${new URL(url).host} respondió ${res.status}`);
  return (await res.json()) as T;
}

// Ejecuta `fn` sobre cada elemento con un máximo de peticiones a la vez.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
