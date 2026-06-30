"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { btnPrimary } from "../_ui";
import { exportMyData } from "./actions";

export function ExportButton() {
  const t = useTranslations("account");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setPending(true);
    setError(null);
    const res = await exportMyData();
    setPending(false);
    if ("error" in res) {
      setError(t("privacy.exportError"));
      return;
    }
    // Téléchargement déclenché côté client : la Server Action renvoie les
    // données, pas une réponse HTTP avec Content-Disposition.
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swiss3design-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button type="button" onClick={onExport} disabled={pending} className={btnPrimary}>
        <Download size={15} />
        {pending ? t("security.processing") : t("privacy.exportButton")}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-accent">{error}</p>}
    </div>
  );
}
