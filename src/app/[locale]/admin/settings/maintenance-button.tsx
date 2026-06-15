"use client";

import { useState } from "react";
import { Trash2, CheckCircle2 } from "lucide-react";
import { BTN_GHOST } from "../ui";

interface Report {
  retentionFilesDeleted: number;
  quotesDeleted: number;
  orphansDeleted: number;
}

export function MaintenanceButton() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);

  async function run() {
    setRunning(true);
    setReport(null);
    setError(false);
    try {
      const res = await fetch("/api/cron/maintenance", { method: "POST" });
      if (!res.ok) throw new Error();
      setReport((await res.json()) as Report);
    } catch {
      setError(true);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={running}
        className={BTN_GHOST}
      >
        <Trash2 size={15} />
        {running ? "Nettoyage…" : "Lancer le nettoyage"}
      </button>
      {report && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} className="shrink-0" />
          {report.orphansDeleted} fichier(s) orphelin(s) ·{" "}
          {report.retentionFilesDeleted} fichier(s) anciens ·{" "}
          {report.quotesDeleted} devis supprimé(s).
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          Échec du nettoyage. Réessayez.
        </p>
      )}
    </div>
  );
}
