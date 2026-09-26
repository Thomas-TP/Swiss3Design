"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackException } from "@/lib/analytics";

// Filet pour toute erreur non gérée dans l'arbre [locale]
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
    // Une erreur rattrapée par React ne remonte pas jusqu'à window.onerror :
    // sans cet envoi, le suivi d'erreurs de PostHog ne la verrait jamais.
    trackException(error, { digest: error.digest, boundary: "locale" });
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface ring-1 ring-line">
        <TriangleAlert size={26} strokeWidth={1.6} className="text-soft" />
      </span>
      <h1 className="mt-6 text-2xl font-bold">{t("errorTitle")}</h1>
      <p className="mt-2 text-soft">{t("errorText")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        {t("retry")}
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
