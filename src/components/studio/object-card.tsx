import { buttonClass } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { SiteLink } from "@/components/ui/site-link";
import type { StudioObjectId, StudioTexts } from "@/lib/studio/types";
import { ObjectPreview } from "./object-poster";

// Carte d'un objet du Studio (index du Studio, rangée « À personnaliser au
// Studio » de la boutique), brief « Strates » §6.12 et §7.8. L'aperçu de l'objet,
// dans ses couleurs, ouvre la carte (c'est lui qui la distingue d'un article de
// la boutique) ; dessous le nom, une ligne, les chiffres de l'objet par défaut
// si la page les calcule, « Sur devis » ou la fourchette, et le bouton
// « Personnaliser → ». Toute la carte est un seul lien (le titre l'étire), le
// bouton n'est que son dessin. Rendue par le serveur : aucun JavaScript.

export function ObjectCard({
  object,
  locale,
  texts,
  name,
  tagline,
  figures,
  price,
  cta,
  level = 3,
  className,
}: {
  object: StudioObjectId;
  locale: string;
  /** Textes d'exemple de la langue : la taille des lignes de texte de l'aperçu. */
  texts: StudioTexts;
  name: string;
  tagline: string;
  /** Dimensions, masse et durée de l'objet par défaut (l'index du Studio les calcule). */
  figures?: string;
  /** « Sur devis » ou la fourchette de prix. */
  price: string;
  cta: string;
  /** Niveau du titre : 2 sous le h1 de l'index, 3 sous le titre de la rangée de la boutique. */
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div
      className={cx(
        "group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors duration-150 ease-strate hover:border-ink",
        className,
      )}
    >
      <ObjectPreview
        object={object}
        texts={texts}
        locale={locale}
        className="aspect-[5/4] border-b border-line bg-paper p-4"
      />
      <div className="flex flex-1 flex-col p-5">
        <Heading className="font-display text-[1.125rem] font-bold leading-snug tracking-tight text-ink">
          <SiteLink
            href={`/studio/${object}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
          >
            {name}
          </SiteLink>
        </Heading>
        <p className="mt-2 flex-1 text-sm text-soft">{tagline}</p>
        {figures ? (
          <p className="s3d-label mt-4 normal-case text-soft">{figures}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="s3d-label normal-case text-ink">{price}</span>
          <span
            aria-hidden="true"
            className={buttonClass({
              variant: "secondary",
              size: "sm",
              className: "group-hover:bg-ink group-hover:text-paper",
            })}
          >
            {cta} →
          </span>
        </div>
      </div>
    </div>
  );
}
