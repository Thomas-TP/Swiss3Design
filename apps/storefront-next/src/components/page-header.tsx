import type { ReactNode } from "react";

/*
 * En-tête de page unifié : surtitre optionnel (eyebrow), tick accent, titre,
 * intro et zone d'actions. Toutes les pages l'utilisent pour garantir le même
 * rythme vertical et la même hiérarchie — c'est LE point de cohérence du site.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div>
        <span className="flex h-1 w-10 rounded-full bg-accent" />
        {eyebrow && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-soft">
            {eyebrow}
          </p>
        )}
        <h1
          className={`text-3xl font-bold tracking-tight md:text-4xl ${eyebrow ? "mt-1.5" : "mt-3"}`}
        >
          {title}
        </h1>
        {intro && (
          <p className="mt-3 max-w-2xl leading-relaxed text-soft">{intro}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
