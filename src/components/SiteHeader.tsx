import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { NavGroup } from "./NavGroup";

// Cabecera común a todas las páginas: marca y navegación. `current` marca la página en la que estás.
export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-5 px-4 py-5 md:px-10">
      <Link href="/" className="text-2xl font-extrabold tracking-[-0.03em] [font-stretch:125%]">
        {es.footer.brand}
      </Link>
      <nav aria-label={es.nav.label} className="flex items-center gap-3 text-[13.5px] font-semibold sm:gap-7 sm:text-[14.5px]">
        {/* en móvil solo quedan las páginas (las secciones de la portada se ven haciendo scroll) */}
        <div className="hidden sm:block">
          <NavGroup text={es.nav.home.text} links={es.nav.home.links} />
        </div>
        {es.nav.links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current === l.key ? "page" : undefined}
            className="whitespace-nowrap text-muted transition-colors duration-300 hover:text-ink aria-[current=page]:text-ink"
          >
            {l.text}
          </Link>
        ))}
      </nav>
    </header>
  );
}
