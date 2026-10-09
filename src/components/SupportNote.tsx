"use client";

import { ArrowUpRightIcon, HeartIcon } from "@phosphor-icons/react/dist/ssr";
import { useI18n } from "@/components/I18nProvider";
import { donateLink } from "@/lib/support";

// Por qué los precios por nota los pone el usuario (no hay dinero para la API de pago) y cómo apoyar el
// proyecto. Sale en la ficha de precios y en el portafolio. `compact`: versión corta en una línea.
export function SupportNote({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { t: dict } = useI18n();
  const t = dict.support;
  if (process.env.NEXT_PUBLIC_PAID_PRICES === "1") return null;
  const link = donateLink();
  const button = link ? (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-panel transition-transform duration-150 active:scale-[0.97]"
    >
      <HeartIcon size={16} weight="fill" aria-hidden />
      {t.button(link.platform)}
      <ArrowUpRightIcon size={13} weight="bold" aria-hidden />
    </a>
  ) : (
    <p className="text-[13.5px] text-muted">{t.soon}</p>
  );

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl bg-soft px-5 py-4 ${className}`}>
        <p className="max-w-[70ch] text-[14px] leading-relaxed">
          <b className="font-semibold">{t.title}</b> {t.text}
        </p>
        {button}
      </div>
    );
  }
  return (
    <aside className={`rounded-2xl bg-soft p-5 md:p-6 ${className}`} aria-labelledby="support-title">
      <h3 id="support-title" className="text-[16px] font-bold leading-snug">{t.title}</h3>
      <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed">{t.text}</p>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">{t.cta}</p>
      <div className="mt-4">{button}</div>
    </aside>
  );
}
