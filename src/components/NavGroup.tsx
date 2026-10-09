"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

// Una entrada de la cabecera que agrupa varios enlaces (las secciones de la portada) en un menú.
// Se abre al pasar el ratón o al pulsar; se cierra al salir, al pulsar fuera, con Escape o al elegir.
export function NavGroup({ text, links }: { text: string; links: readonly { href: string; text: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hovered = useRef(false); // abierto al pasar el ratón (el primer clic no debe cerrarlo)
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hovered.current = true;
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hovered.current = false;
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        // si el ratón ya lo abrió al pasar, el clic no lo cierra; con dedo o teclado, el clic abre y cierra
        onClick={() => {
          if (hovered.current) hovered.current = false;
          else setOpen((o) => !o);
        }}
        className="flex items-center gap-1 whitespace-nowrap text-muted transition-colors duration-300 hover:text-ink aria-expanded:text-ink"
      >
        {text}
        <CaretDownIcon size={12} weight="bold" aria-hidden className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {/* pt-2 en vez de margen: el hueco sigue siendo parte del menú y el ratón no lo cierra al bajar */}
      <div id={id} hidden={!open} className="absolute left-1/2 top-full z-30 -translate-x-1/2 pt-2">
        <ul className="min-w-[180px] animate-[fade-in_150ms_ease-out] rounded-xl border border-line bg-panel p-1.5 shadow-lg motion-reduce:animate-none">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-muted transition-colors duration-150 hover:bg-soft hover:text-ink"
              >
                {l.text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
