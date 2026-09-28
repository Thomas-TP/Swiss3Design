import type { ReactNode } from "react";
import { cx } from "./cx";
import { DotTitle } from "./dot-title";

// Chapitre éditorial (brief « Strates », §3.3, §7.5, §7.9, §7.11) : une
// <section data-chapter="01"> que ChapterRail suit (IntersectionObserver) et
// que les chorégraphies retrouvent par son attribut. En-tête SSR complet :
// numéro mono, surtitre, titre d'affichage (point rouge final) ; le texte est
// là au premier paint, le mouvement ne fait que l'enrichir (§3.1, principe 4).
//
// `tone="ink"` : chapitre « encre » (data-tone, globals.css) qui ne flashe
// jamais en blanc ; en thème sombre il devient `elevated` bordé de rouge.
// Les enfants sont rendus tels quels, sans conteneur : un chapitre peut
// porter une vue du Stage pleine largeur ; l'en-tête, lui, est dans
// .s3d-page. `scroll-mt-24` : les ancres tombent sous le header (64 + 32).

export function Chapter({
  id,
  number,
  title,
  eyebrow,
  intro,
  tone,
  className,
  headerClassName,
  children,
}: {
  /** Ancre (#id) et base de l'identifiant du titre. */
  id: string;
  /** « 01 », « 02 »… (texte : l'ordre vient de l'auteur, pas d'un compteur). */
  number: string;
  title: string;
  eyebrow?: ReactNode;
  intro?: ReactNode;
  tone?: "paper" | "ink";
  className?: string;
  headerClassName?: string;
  children?: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      data-chapter={number}
      data-tone={tone}
      aria-labelledby={titleId}
      className={cx("relative scroll-mt-24 py-section", className)}
    >
      <header className={cx("s3d-page", headerClassName)}>
        <p className="s3d-label text-soft">
          <span className="text-ink">{number}</span>
          {eyebrow ? (
            <>
              <span aria-hidden="true" className="mx-2 text-iso-index">
                ·
              </span>
              {eyebrow}
            </>
          ) : null}
        </p>
        <DotTitle
          as="h2"
          id={titleId}
          className="mt-4 max-w-[18ch] font-display text-display text-ink"
        >
          {title}
        </DotTitle>
        {intro ? (
          <div className="mt-6 max-w-[65ch] text-lead text-soft">{intro}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
