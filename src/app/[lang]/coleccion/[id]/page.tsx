import type { Metadata } from "next";
import { AlbumView } from "@/components/collection/AlbumView";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { langOf } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/coleccion/[id]">): Promise<Metadata> {
  const { t } = await langOf(params);
  return { title: t.collection.metaTitle, robots: { index: false } };
}

// Un álbum. El id viene de la URL; el contenido se lee del navegador (no es indexable).
export default async function AlbumPage({ params }: PageProps<"/[lang]/coleccion/[id]">) {
  const { id } = await params;
  return (
    <>
      <div className="bg-[radial-gradient(70%_60%_at_50%_10%,var(--stage-a),var(--stage-b)_85%)] pb-4">
        <SiteHeader current="coleccion" />
        <main className="pt-4">
          <AlbumView id={id} />
        </main>
      </div>
      <Footer />
    </>
  );
}
