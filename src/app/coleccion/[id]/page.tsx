import type { Metadata } from "next";
import { AlbumView } from "@/components/collection/AlbumView";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.collection.metaTitle, robots: { index: false } };

// Un álbum. El id viene de la URL; el contenido se lee del navegador (no es indexable).
export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
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
