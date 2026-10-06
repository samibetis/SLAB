import { es } from "@/lib/i18n/es";
import { AnalysisPanel } from "./prices/AnalysisPanel";
import { CsvButton } from "./prices/CsvButton";
import { ManualPrices } from "./prices/ManualPrices";
import { PricesPanel } from "./prices/PricesPanel";
import { PriceHeader } from "./PriceHeader";
import s from "./Sections.module.css";

// Las secciones son de servidor; solo sus paneles interactivos (precios, análisis, CSV) son de cliente.
export function PricesSection() {
  return (
    <section className={s.card} id="precios" aria-labelledby="title">
      <PriceHeader />
      <PricesPanel />
      <ManualPrices />
    </section>
  );
}

export function AnalysisSection() {
  const t = es.analysis;
  return (
    <section className={s.card} id="fluctuacion">
      <h2>{t.title}</h2>
      <p className={s.sub}>{t.sub}</p>
      <AnalysisPanel />
    </section>
  );
}

export function HowSection() {
  const t = es.how;
  return (
    <section className={s.card} id="como">
      <h2>{t.title}</h2>
      <ol className={s.steps}>
        {t.steps.map((st) => (
          <li key={st.title}>
            <h3>{st.title}</h3>
            <p>{st.text}</p>
          </li>
        ))}
      </ol>
      <div className={s.dataNote}>
        <div>
          <h3>{t.dataTitle}</h3>
          <p>{t.dataText}</p>
          <p>{t.dataCsv}</p>
        </div>
        <CsvButton />
      </div>
    </section>
  );
}
