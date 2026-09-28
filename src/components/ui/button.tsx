import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { SiteLink, type SiteLinkProps } from "./site-link";

// Boutons du système « Strates » (brief §2.1, §2.3). Règle d'or visuelle :
// UN SEUL bouton `primary` (rouge) par écran, c'est la buse chaude, l'action
// principale ; les autres actions sont en contour (`secondary`), en encre
// (`ink`, ex. « OK » du bandeau de consentement), discrètes (`ghost`) ou en
// texte (`text`). Rayon `field` (4 px). Texte blanc sur rouge : 4,58:1, AA
// dès 15 px en 600, d'où la graisse fixée ici. Hauteurs : md = 44 px, la
// cible tactile minimale ; sm (36 px) pour les barres denses seulement.
// Aucun `transform` animé (pas de « bouton magnétique », §3.1).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "ink" | "text";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150 ease-strate disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "rounded-field bg-accent text-on-accent hover:bg-accent-dark",
  secondary:
    "rounded-field border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "rounded-field text-ink hover:bg-line/60",
  ink: "rounded-field bg-ink text-paper hover:bg-ink/85",
  text: "text-ink underline decoration-line decoration-1 underline-offset-4 hover:decoration-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-6 text-base",
};

// Le lien texte n'a ni hauteur ni marge interne : il vit dans une phrase.
const TEXT_SIZES: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-[0.9375rem]",
  lg: "text-base",
};

/** Classes d'un bouton, pour un élément qui n'est ni <button> ni SiteLink. */
export function buttonClass({
  variant = "secondary",
  size = "md",
  full = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
} = {}): string {
  return cx(
    BASE,
    VARIANTS[variant],
    variant === "text" ? TEXT_SIZES[size] : SIZES[size],
    full && "w-full",
    className,
  );
}

type Look = { variant?: ButtonVariant; size?: ButtonSize; full?: boolean };

export function Button({
  variant,
  size,
  full,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Look) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, full, className })}
      {...props}
    />
  );
}

/** Lien habillé en bouton : un SiteLink (« Coupe » et buse d'attente compris). */
export function ButtonLink({
  variant,
  size,
  full,
  className,
  ...props
}: SiteLinkProps & Look) {
  return (
    <SiteLink
      className={buttonClass({ variant, size, full, className })}
      {...props}
    />
  );
}
