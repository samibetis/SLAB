import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Scanner } from "@/components/scanner/Scanner";
import { SiteHeader } from "@/components/SiteHeader";
import { langOf, localeMeta } from "@/lib/i18n/seo";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/escaner">): Promise<Metadata> {
  const { lang, t } = await langOf(params);
  return { title: t.scanner.metaTitle, description: t.scanner.metaDescription, ...localeMeta(lang, "/escaner") };
}

// Escáner de cartas: la página es de servidor; la cámara y el OCR viven en el componente cliente.
export default async function ScannerPage() {
  const t = (await getI18n()).t.scanner;
  return (
    <>
      <div className="bg-[radial-gradient(70%_60%_at_30%_30%,var(--stage-a),var(--stage-b)_85%)]">
        <SiteHeader current="escaner" />
        <main>
          <header className="mx-auto max-w-[1400px] px-4 pb-8 pt-4 md:px-10 md:pb-10">
            <h1 className="text-balance text-[clamp(34px,4.4vw,60px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">
              {t.title}
            </h1>
            <p className="mt-4 max-w-[52ch] text-[clamp(16px,1.25vw,18px)] leading-relaxed text-muted">{t.lead}</p>
          </header>
          <Scanner />
        </main>
      </div>
      <Footer />
    </>
  );
}
