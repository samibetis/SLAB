// Enlace para apoyar el proyecto (Patreon, Ko-fi, PayPal...). Se configura con NEXT_PUBLIC_DONATE_URL;
// sin él, la interfaz explica que pronto habrá uno en vez de enseñar un botón roto.

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)patreon\.com$/, "Patreon"],
  [/(^|\.)ko-fi\.com$/, "Ko-fi"],
  [/(^|\.)paypal\.(com|me)$/, "PayPal"],
  [/(^|\.)buymeacoffee\.com$/, "Buy Me a Coffee"],
  [/(^|\.)github\.com$/, "GitHub Sponsors"],
  [/(^|\.)liberapay\.com$/, "Liberapay"],
];

// "https://ko-fi.com/slab" -> "Ko-fi". Si la plataforma no es conocida, el dominio sin "www.".
export function platformName(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? host;
  } catch {
    return null;
  }
}

// Solo enlaces https bien formados
export function donateLink(url = process.env.NEXT_PUBLIC_DONATE_URL): { url: string; platform: string } | null {
  if (!url || !/^https:\/\//.test(url)) return null;
  const platform = platformName(url);
  return platform ? { url, platform } : null;
}
