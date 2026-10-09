"use client";

import { ArrowRightIcon, CheckIcon, CertificateIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { metaLine, variantLabel } from "@/lib/cards/format";
import { newId, toAlbumCard } from "@/lib/collection/logic";
import { useI18n } from "@/components/I18nProvider";
import { portfolioStore } from "@/lib/portfolio/store";
import { useCard } from "../CardContext";
import { usePrices } from "../prices/PriceContext";
import { Dialog } from "../ui/Dialog";
import { HoldingForm } from "./HoldingForm";
import { saveSlabValue } from "./slabValue";

// "Añadir al portafolio" en la ficha de la carta. Arranca con la empresa, la nota y la versión que
// tienes puestas en el visor: lo que ves en la funda es lo que añades.
export function AddToPortfolio() {
  const { t: dict, path } = useI18n();
  const t = dict.portfolio;
  const { card } = useCard();
  const { variants, variant, grader, gradeId } = usePrices();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (!card) return null;
  const v = variants.find((o) => o.key === variant);

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-soft px-3.5 text-[13.5px] font-semibold transition-[background-color,transform] duration-200 hover:bg-line/60 active:scale-[0.97]"
      >
        <CertificateIcon size={16} weight="bold" aria-hidden />
        {t.addToPortfolio}
      </button>
      <AnimatePresence>
        {done && (
          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} role="status" className="inline-flex items-center gap-2 text-[13.5px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-up">
              <CheckIcon size={15} weight="bold" aria-hidden /> {t.added}
            </span>
            <Link href={path("/portafolio")} className="inline-flex items-center gap-1 underline underline-offset-4">
              {t.see} <ArrowRightIcon size={13} aria-hidden />
            </Link>
          </motion.span>
        )}
      </AnimatePresence>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.formTitle}>
        <HoldingForm
          card={toAlbumCard(card)}
          meta={metaLine(card)}
          initial={{ grader, gradeId, variant, variantName: v ? variantLabel(v) : undefined }}
          submitLabel={t.saveNew}
          onCancel={() => setOpen(false)}
          onSubmit={async ({ value, ...d }) => {
            const now = new Date().toISOString();
            try {
              const h = { ...d, id: newId(), card: toAlbumCard(card), currency: "USD", addedAt: now, updatedAt: now };
              await portfolioStore.save(h);
              if (value) await saveSlabValue(h, value);
              setOpen(false);
              setDone(true);
              setTimeout(() => setDone(false), 5000);
            } catch {
              alert(t.storageError);
            }
          }}
        />
      </Dialog>
    </div>
  );
}
