import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

// Cadre commun des écrans qui précèdent ou interrompent une session : connexion,
// inscription, mot de passe oublié et réinitialisation, consentement OAuth,
// revendication d'agent. Papier calme (brief §7.20) : le mark, un titre
// d'Archivo, une carte à filet `rounded-card`. Aucune isoligne, aucun mouvement,
// aucun Lenis (ces routes sont hors du groupe (site)).
//
// Le <main> appartient au layout racine de [locale] : ce composant n'en rend pas,
// il n'y en a qu'un par page (lien d'évitement « Aller au contenu »).
export function AuthShell({
  title,
  intro,
  icon,
  children,
  below,
}: {
  title: ReactNode;
  /** Phrase sous le titre (contexte, e-mail connecté, avis de réauthentification). */
  intro?: ReactNode;
  /** Remplace le mark (ex. picto d'agent). Décoratif : le titre porte le sens. */
  icon?: ReactNode;
  /** Contenu de la carte. */
  children: ReactNode;
  /** Liens sous la carte (inscription, suivi de commande, retrait d'accès…). */
  below?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-margin py-14 md:py-20">
      <div className="flex justify-center">
        {icon ?? <BrandMark className="h-10 w-10" />}
      </div>
      <h1 className="mt-5 break-words text-center font-display text-title text-ink">
        {title}
      </h1>
      {intro && <p className="mt-3 text-center text-sm text-soft">{intro}</p>}
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        {children}
      </div>
      {below}
    </div>
  );
}
