import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// Puces (brief « Strates », §7.8 filtres de la boutique, §5.6 contrôles du
// héros, Studio). Deux formes, un seul dessin :
// - chipClass / Chip : étiquette statique, ou lien de filtre SSR (sans JS) en
//   passant chipClass(active) à un SiteLink ;
// - ChipRadio : un VRAI bouton radio natif, visuellement masqué, dont la puce
//   est le libellé. Le groupe (fieldset + legend chez l'appelant) garde la
//   navigation aux flèches, l'annonce « 2 sur 4 » et le formulaire GET sans JS.
// Choisie = encre pleine (pas de rouge : le rouge reste au CTA de l'écran).

const BASE =
  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-strate";

/** Classes d'une puce ; `active` = sélectionnée (lien de filtre courant). */
export function chipClass(active = false, className?: string): string {
  return cx(
    BASE,
    active
      ? "border-ink bg-ink text-paper"
      : "border-line text-ink hover:border-ink",
    className,
  );
}

export function Chip({
  active = false,
  className,
  children,
}: {
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <span className={chipClass(active, className)}>{children}</span>;
}

export function ChipRadio({
  children,
  className,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  children: ReactNode;
}) {
  return (
    <label className={cx("relative inline-flex cursor-pointer", className)}>
      <input type="radio" className="peer sr-only" {...input} />
      <span
        className={cx(
          BASE,
          "border-line text-ink hover:border-ink",
          "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        )}
      >
        {children}
      </span>
    </label>
  );
}
