"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

// Carte « Configuration Studio jointe » (brief « Strates », §7.10) : ce que le
// Studio a déjà préparé pour la demande (vignette, résumé, fichier déjà
// envoyé), avec les deux gestes qui restent au visiteur : « Modifier dans le
// Studio » (retour à la configuration) et « Retirer » (demande sans Studio).
// Présentation pure : la page /custom la nourrit avec le passage lu par
// readQuoteHandoff(), le tiroir du Studio avec sa propre configuration. Pas
// de WebGL ici : la vignette est une image précalculée (data: URL).

export interface StudioAttachmentCardProps {
  /** Nom de l'objet (« Vase « Lavaux » »), dans la langue du visiteur. */
  title: string;
  /** Une ligne par donnée réelle : dimensions, couleurs, fichier… */
  lines: string[];
  /** Note discrète sous la liste (« Champs préremplis… »). */
  note?: string;
  /** Vignette : URL d'image, décorative (le résumé dit la même chose). */
  thumbnail?: string;
  /** « Modifier dans le Studio » : chemin ou URL de ce site (lien de configuration). */
  editHref?: string;
  /** « Retirer » : absent, le bouton n'est pas affiché. */
  onRemove?: () => void;
  className?: string;
}

export function StudioAttachmentCard({
  title,
  lines,
  note,
  thumbnail,
  editHref,
  onRemove,
  className,
}: StudioAttachmentCardProps) {
  const t = useTranslations("quote.studioCard");
  const labelId = useId();

  return (
    <section
      aria-labelledby={labelId}
      className={cx("rounded-card border border-line bg-paper", className)}
    >
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        {thumbnail ? (
          // Vignette décorative : le titre et les lignes portent l'information.
          <img
            src={thumbnail}
            alt=""
            className="size-20 shrink-0 rounded-hair border border-line bg-surface object-contain sm:size-24"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p id={labelId} className="s3d-label text-soft">
            {t("kicker")}
          </p>
          <p className="mt-1.5 font-display text-lg font-bold leading-snug text-ink">
            {title}
          </p>
          {lines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {lines.map((line, index) => (
                // Lignes d'un résumé figé : l'ordre ne change jamais.
                <li key={index} className="break-words">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {note ? <p className="mt-3 text-sm text-soft">{note}</p> : null}
        </div>
      </div>
      {editHref || onRemove ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
          {editHref ? (
            // Lien de configuration ; une navigation complète suffit (le Studio
            // relit son état dans le fragment), sans préfixe de locale à
            // rajouter : le lien est déjà celui de la page du Studio.
            <a
              href={editHref}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              {t("edit")}
            </a>
          ) : null}
          {onRemove ? (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              {t("remove")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
