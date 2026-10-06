"use client";

import dynamic from "next/dynamic";
import { es } from "@/lib/i18n/es";

// Mientras llega three.js: la silueta de la funda con brillo de carga, del mismo tamaño que el visor,
// para que la página no salte cuando aparece.
function ViewerSkeleton() {
  return (
    <div aria-busy aria-label={es.viewer.loading}>
      <div className="mx-auto grid aspect-[3/4] w-[min(100%,calc(78dvh*0.75))] place-items-center">
        <div className="flex aspect-[298/478] w-[66%] flex-col gap-[4%] rounded-2xl border border-line p-[4%]">
          <div className="skeleton h-[12%] w-full rounded-md" />
          <div className="skeleton w-full flex-1 rounded-xl" />
        </div>
      </div>
      <div className="skeleton mx-auto -mt-3 h-[52px] w-[min(100%,420px)] rounded-2xl" />
      <div className="h-[30px]" />
    </div>
  );
}

// Carga diferida: three.js no entra en el JS inicial de la página.
const CardViewer = dynamic(() => import("./CardViewer"), { ssr: false, loading: ViewerSkeleton });

export function CardViewerLoader() {
  return <CardViewer />;
}
