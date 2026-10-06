import { es } from "@/lib/i18n/es";
import s from "./Footer.module.css";

export function Footer() {
  const t = es.footer;
  return (
    <footer className={s.foot}>
      <span>
        <b>{t.brand}</b> {t.tagline}
      </span>
      <span>{t.prices}</span>
      <span className={s.legal}>{t.affiliation}</span>
    </footer>
  );
}
