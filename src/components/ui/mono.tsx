import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "./cx";

// Télémétrie et étiquettes (brief « Strates », §2.2, motif M3) : Geist Mono,
// majuscules, chasse +0,06em, chiffres tabulaires à zéro barré, 12 px au
// minimum (jamais de HUD en 11 px). Un chiffre affiché est toujours formaté
// par Intl.NumberFormat en `${locale}-CH` (comme formatChf) : « 0,2 mm » en
// fr-CH, « 0.2 mm » en de-CH, séparateur de milliers laissé à ICU.

export function MonoLabel({
  as: Tag = "span",
  className,
  children,
  id,
}: {
  as?: "span" | "p" | "dt" | "div";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag id={id} className={cx("s3d-label", className)}>
      {children}
    </Tag>
  );
}

/**
 * Nombre en chiffres tabulaires. Avec `value`, formaté pour la locale suisse
 * courante (options Intl.NumberFormat) ; sans, les enfants sont rendus tels
 * quels (valeur déjà formatée ailleurs, par exemple par src/lib/studio/format).
 */
export function Num({
  value,
  options,
  unit,
  className,
  children,
}: {
  value?: number;
  options?: Intl.NumberFormatOptions;
  /** Unité ajoutée après une espace insécable (« mm », « g »…). */
  unit?: string;
  className?: string;
  children?: ReactNode;
}) {
  const locale = useLocale();
  const text =
    value === undefined
      ? children
      : new Intl.NumberFormat(`${locale}-CH`, options).format(value);
  return (
    <span className={cx("s3d-num", className)}>
      {text}
      {unit ? ` ${unit}` : null}
    </span>
  );
}
