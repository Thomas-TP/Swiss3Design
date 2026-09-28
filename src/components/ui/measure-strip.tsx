import { Fragment } from "react";
import { cx } from "./cx";

// Bande de mesure (brief « Strates », motif M3) : la télémétrie mono du héros,
// du Studio et du chapitre 02 (« 150,0 mm · 750 couches · ≈ 80 g · ≈ 2 h 45 »).
// Composant de pure présentation : les valeurs arrivent déjà formatées
// (Intl.NumberFormat en `${locale}-CH`, helpers de src/lib/studio/format.ts),
// calculées, jamais décoratives. Les « · » sont décoratifs : un lecteur
// d'écran entend une virgule à la place. `ph-no-capture` : une bande qui
// change en continu gonflerait les replays (§4.10). `live` n'est à poser que
// sur une bande mise à jour par un geste (debounce côté appelant), jamais
// pendant une animation.

export function MeasureStrip({
  items,
  live = false,
  label,
  className,
}: {
  items: string[];
  live?: boolean;
  /** Préfixe lu par les lecteurs d'écran seulement (« Mesures de l'objet »). */
  label?: string;
  className?: string;
}) {
  const shown = items.filter((item) => item.length > 0);
  return (
    <p
      aria-live={live ? "polite" : undefined}
      className={cx(
        "s3d-label ph-no-capture flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ink",
        className,
      )}
    >
      {label && <span className="sr-only">{`${label}, `}</span>}
      {shown.map((item, index) => (
        <Fragment key={`${index}-${item}`}>
          {index > 0 && (
            <>
              <span aria-hidden="true" className="text-iso-index">
                ·
              </span>
              <span className="sr-only">, </span>
            </>
          )}
          <span className="whitespace-nowrap">{item}</span>
        </Fragment>
      ))}
    </p>
  );
}
