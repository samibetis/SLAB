import Link from "next/link";
import { es } from "@/lib/i18n/es";

// Cabecera común a todas las páginas: marca y navegación. `current` marca la página en la que estás.
export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-5 px-4 py-5 md:px-10">
      <Link href="/" className="text-2xl font-extrabold tracking-[-0.03em] [font-stretch:125%]">
        {es.footer.brand}
      </Link>
      <nav aria-label={es.nav.label} className="flex gap-5 text-[14.5px] font-semibold sm:gap-7">
        {es.nav.links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current === l.key ? "page" : undefined}
            // en móvil solo quedan las páginas (las secciones de la portada se ven haciendo scroll)
            className={`text-muted transition-colors duration-300 hover:text-ink aria-[current=page]:text-ink ${
              l.href.startsWith("/#") ? "hidden sm:inline" : ""
            }`}
          >
            {l.text}
          </Link>
        ))}
      </nav>
    </header>
  );
}
