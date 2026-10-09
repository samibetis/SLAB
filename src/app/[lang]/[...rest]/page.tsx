import { notFound } from "next/navigation";

// Cualquier dirección que no sea una página: 404 dentro del layout del idioma (con cabecera y pie).
export default function CatchAll() {
  notFound();
}
