"use client";

import { DownloadSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { backupFileName, parseBackup } from "@/lib/backup";
import { exportAll, importAll } from "@/lib/backup-store";
import { useI18n } from "@/components/I18nProvider";

const btn =
  "inline-flex min-h-10 items-center gap-2 rounded-xl bg-soft px-3.5 text-[13.5px] font-semibold transition-[background-color,transform] duration-150 hover:bg-line/60 active:scale-[0.97] disabled:opacity-50";

// Exportar / importar la copia de seguridad (álbumes, portafolio y precios puestos a mano).
export function BackupControls({ className = "" }: { className?: string }) {
  const { t: dict } = useI18n();
  const t = dict.backup;
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function download() {
    setBusy(true);
    try {
      const b = await exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: backupFileName() });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg({ ok: true, text: t.exported(b.data.albums.length, b.data.holdings.length, b.data.prices.length) });
    } catch {
      setMsg({ ok: false, text: t.storageError });
    } finally {
      setBusy(false);
    }
  }

  async function upload(f: File) {
    setBusy(true);
    try {
      const r = parseBackup(await f.text());
      if (!r.ok) return setMsg({ ok: false, text: t.errors[r.error] });
      await importAll(r.backup);
      setMsg({ ok: true, text: t.imported(r.counts.albums, r.counts.holdings, r.counts.prices) });
    } catch {
      setMsg({ ok: false, text: t.storageError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <p className="text-[13.5px] font-semibold">{t.title}</p>
      <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-muted">{t.hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={busy} className={btn}>
          <DownloadSimpleIcon size={16} weight="bold" aria-hidden /> {t.export}
        </button>
        <button type="button" onClick={() => file.current?.click()} disabled={busy} className={btn}>
          <UploadSimpleIcon size={16} weight="bold" aria-hidden /> {t.import}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          className="vh"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
      </div>
      <p aria-live="polite" className={`mt-2 min-h-[1.2em] text-[13px] ${msg?.ok === false ? "text-down" : "text-up"}`}>
        {msg?.text}
      </p>
    </div>
  );
}
