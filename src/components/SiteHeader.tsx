import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { LangSwitch } from "./LangSwitch";
import { NavGroup } from "./NavGroup";

// Cabecera común a todas las páginas: marca, navegación y switch de idioma. `current` marca la página en la que estás.
export async function SiteHeader({ current }: { current?: string }) {
  const { t, path } = await getI18n();
  return (
    // en móvil, dos filas: marca y switch arriba, y la navegación debajo a todo el ancho; desde sm, una sola fila
    <header className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-7 gap-y-3 px-4 py-5 md:px-10">
      <Link href={path("/")} className="mr-auto text-2xl font-extrabold tracking-[-0.03em] [font-stretch:125%]">
        {t.footer.brand}
      </Link>
      <nav
        aria-label={t.nav.label}
        className="order-last flex w-full items-center justify-between text-[14px] font-semibold sm:order-none sm:w-auto sm:justify-start sm:gap-7 sm:text-[14.5px]"
      >
        {/* en móvil solo quedan las páginas (las secciones de la portada se ven haciendo scroll) */}
        <div className="hidden sm:block">
          <NavGroup text={t.nav.home.text} links={t.nav.home.links.map((l) => ({ ...l, href: path(l.href) }))} />
        </div>
        {t.nav.links.map((l) => (
          <Link
            key={l.href}
            href={path(l.href)}
            aria-current={current === l.key ? "page" : undefined}
            className="whitespace-nowrap text-muted transition-colors duration-300 hover:text-ink aria-[current=page]:text-ink"
          >
            {l.text}
          </Link>
        ))}
      </nav>
      <LangSwitch />
    </header>
  );
}
