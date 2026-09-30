"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackException } from "@/lib/analytics";
import { Button, ButtonLink } from "@/components/ui/button";
import { withDot } from "@/components/ui/dot-title";

// Filet pour toute erreur non gérée dans l'arbre [locale] (brief « Strates »
// §7.19). Restyle seul : `trackException` et `reset` sont ceux d'avant. Message
// sobre, une seule action rouge (réessayer), un lien vers l'accueil. La
// référence technique (digest) est affichée en mono : c'est ce que le client
// nous communique s'il nous écrit.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const ts = useTranslations("system.error");

  useEffect(() => {
    console.error(error);
    // Une erreur rattrapée par React ne remonte pas jusqu'à window.onerror :
    // sans cet envoi, le suivi d'erreurs de PostHog ne la verrait jamais.
    trackException(error, { digest: error.digest, boundary: "locale" });
  }, [error]);

  return (
    <div className="s3d-page py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="s3d-label text-soft">{ts("kicker")}</p>
        <h1 className="mt-3 font-display text-display break-words text-ink">
          {withDot(ts("title"))}
        </h1>
        <p className="mt-5 max-w-xl text-lead text-soft">{t("errorText")}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button variant="primary" size="lg" onClick={reset}>
            <RotateCcw size={18} strokeWidth={1.5} />
            {t("retry")}
          </Button>
          <ButtonLink href="/" variant="text" size="lg">
            {t("notFoundCta")}
          </ButtonLink>
        </div>
        {error.digest && (
          <p className="s3d-label mt-10 text-soft normal-case">
            {ts("reference", { digest: error.digest })}
          </p>
        )}
      </div>
    </div>
  );
}
