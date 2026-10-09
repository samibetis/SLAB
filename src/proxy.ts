import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG, LANG_COOKIE } from "@/lib/i18n";

// Idioma de cada dirección. Las páginas viven en app/[lang]/…, pero en la barra de direcciones el español
// va sin prefijo (/colecciones) y el inglés con /en (/en/colecciones):
// - /en/…            -> tal cual.
// - /es/…            -> redirige a la dirección sin prefijo (una sola dirección por página para Google).
// - cualquier otra   -> se sirve /es/… por dentro (rewrite: la dirección no cambia).
// En la portada, quien no ha elegido idioma con el switch va al inglés si su navegador no está en español.
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = url;

  if (pathname === "/en" || pathname.startsWith("/en/")) return NextResponse.next();

  if (pathname === `/${DEFAULT_LANG}` || pathname.startsWith(`/${DEFAULT_LANG}/`)) {
    url.pathname = pathname.slice(DEFAULT_LANG.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/") {
    const chosen = req.cookies.get(LANG_COOKIE)?.value;
    if (chosen === "en" || (!chosen && prefersEnglish(req.headers.get("accept-language")))) {
      url.pathname = "/en";
      return NextResponse.redirect(url, 307);
    }
  }

  url.pathname = `/${DEFAULT_LANG}${pathname}`;
  return NextResponse.rewrite(url);
}

// El primer idioma que pide el navegador. Sin cabecera (buscadores) o en español, español; si no, inglés.
function prefersEnglish(header: string | null): boolean {
  const first = header?.split(",")[0]?.trim().toLowerCase();
  return !!first && first !== "*" && !first.startsWith("es");
}

export const config = {
  // Todo menos la API, los archivos internos de Next y los archivos con extensión (imágenes, sitemap.xml…)
  matcher: ["/((?!api/|_next/|.*\\.[\\w]+$).*)"],
};
