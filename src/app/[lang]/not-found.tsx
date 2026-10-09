import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { getI18n } from "@/lib/i18n/server";

// 404 en el idioma de la dirección (las que no existen llegan aquí por [...rest]).
export default async function NotFound() {
  const { t, path } = await getI18n();
  return (
    <>
      <title>{t.notFound.metaTitle}</title>
      <div className="min-h-[70dvh] bg-[radial-gradient(70%_60%_at_30%_20%,var(--stage-a),var(--stage-b)_85%)]">
        <SiteHeader />
        <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-10 md:px-10">
          <p className="text-[clamp(64px,9vw,120px)] font-extrabold leading-none tracking-[-0.04em] text-muted [font-stretch:125%]">404</p>
          <h1 className="mt-4 text-[clamp(28px,3.4vw,44px)] font-extrabold leading-tight tracking-[-0.02em] [font-stretch:115%]">{t.notFound.title}</h1>
          <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-muted">{t.notFound.text}</p>
          <Link href={path("/")} className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 font-semibold text-panel transition-transform duration-150 active:scale-[0.97]">
            {t.notFound.home}
          </Link>
        </main>
      </div>
      <Footer />
    </>
  );
}
