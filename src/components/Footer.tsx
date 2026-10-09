import { getI18n } from "@/lib/i18n/server";
import s from "./Footer.module.css";

export async function Footer() {
  const t = (await getI18n()).t.footer;
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
