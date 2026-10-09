import type { ReactNode } from "react";
import { cx } from "./cx";

// Champs de formulaire (brief « Strates », §2.3 : rayon `field` 4 px, fond
// `elevated`, jamais de grille de filets autour d'un formulaire). fieldClass
// habille <input>, <textarea> et le déclencheur de Select : même bordure,
// même focus (encre + halo discret, pas de rouge), même état invalide
// (`aria-invalid`, bordure `accent-text`, 6:1 et plus sur tous les fonds).
// Taille de texte 16 px en mobile : en dessous, iOS zoome sur le champ.
// Placeholder en `soft` plein (WP-99) : à 70 % il tombait à 3,1:1 en clair
// alors qu'il porte de l'information (« N° ou e-mail… »).

/** Habillage seul (sans display ni largeur), pour un déclencheur en flex. */
export const fieldSkin = cx(
  "rounded-field border border-line bg-elevated px-3.5 py-2.5 text-base text-ink sm:text-[0.9375rem]",
  "placeholder:text-soft transition-colors duration-150 hover:border-iso",
  "focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/15",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-invalid:border-accent-text",
);

export const fieldClass = cx("block w-full", fieldSkin);

/** Identifiants d'aide et d'erreur d'un champ, pour aria-describedby. */
export function fieldIds(id: string) {
  return { hint: `${id}-hint`, error: `${id}-error` };
}

/**
 * Libellé + contrôle + aide + erreur. Le contrôle (enfant) reçoit lui-même
 * `id={htmlFor}`, `aria-describedby` (fieldIds) et `aria-invalid` : Field ne
 * clone rien, il met en page. L'erreur est un texte, jamais une couleur seule.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ids = fieldIds(htmlFor);
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="s3d-label text-soft">
        {label}
        {required && (
          <span aria-hidden="true" className="text-accent-text">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={ids.hint} className="text-sm text-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.error} className="text-sm font-medium text-accent-text">
          {error}
        </p>
      )}
    </div>
  );
}
