import { es } from "@/lib/i18n/es";
import { SearchBox } from "./search/SearchBox";
import { SiteHeader } from "./SiteHeader";
import { CardViewerLoader } from "./viewer/CardViewerLoader";

// Hero en dos columnas asimétricas: a la izquierda titular y buscador, a la derecha el visor 3D.
// Es de servidor; solo el buscador y el visor son componentes de cliente.
export function Hero() {
  const t = es.hero;
  return (
    <div
      id="top"
      className="relative isolate overflow-hidden bg-[radial-gradient(70%_80%_at_78%_45%,var(--stage-a),var(--stage-b)_80%)]"
    >
      <SiteHeader />

      <section className="mx-auto grid min-h-[calc(100dvh-76px)] max-w-[1400px] grid-cols-1 items-center gap-10 px-4 pb-14 pt-4 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] md:gap-12 md:px-10 lg:gap-20">
        <div className="max-w-[640px]">
          <h1 className="text-balance text-[clamp(42px,5.8vw,86px)] font-extrabold leading-[0.92] tracking-[-0.035em] [font-stretch:125%]">
            {t.titleA} <span className="text-muted">{t.titleB}</span>
          </h1>
          <p className="mb-9 mt-7 max-w-[44ch] text-[clamp(16.5px,1.35vw,19px)] leading-relaxed text-muted">{t.lead}</p>
          <SearchBox />
        </div>
        <div className="w-full min-w-0 md:justify-self-end" aria-label={es.viewer.label}>
          <CardViewerLoader />
        </div>
      </section>
    </div>
  );
}
