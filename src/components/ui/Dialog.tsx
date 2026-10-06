"use client";

import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { es } from "@/lib/i18n/es";

// Ventana modal con <dialog> nativo: atrapa el foco, Escape la cierra y el fondo se oscurece solo.
// Pulsar fuera (en el fondo) también la cierra.
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal enfoca el primer botón (cerrar); mejor el campo marcado con data-autofocus
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className="m-auto w-[min(460px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-3xl bg-panel p-0 text-ink shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.1),0_40px_80px_-30px_rgb(var(--shadow-tint)/0.6)] backdrop:bg-[rgb(var(--shadow-tint)/0.45)] open:animate-[dialog-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:open:animate-none"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] [font-stretch:115%]">{title}</h2>
            <button type="button" onClick={onClose} aria-label={es.ui.close} className="-mr-2 -mt-1 grid size-9 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-soft hover:text-ink">
              <XIcon size={18} weight="bold" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
