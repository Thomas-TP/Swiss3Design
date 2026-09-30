// Classes utilitaires partagées par l'espace compte (onglets, formulaires
// d'authentification, consentement OAuth). Habillage « Strates » (brief §7.20) :
// ce fichier ne redéfinit rien, il assemble les primitives de src/components/ui
// (Field, Button) pour que les onglets restent cohérents entre eux.
//
// Règles tenues ici :
// - UN SEUL bouton rouge (`btnAccent`) par écran : l'action principale de la
//   page. Les enregistrements répétés d'un onglet (`btnPrimary`) sont en encre,
//   les actions secondaires (`btnGhost`) en contour.
// - Aucun texte rouge sous 24 px hors `accent-text` (6:1 et plus sur tous les
//   fonds) ; aucune animation décorative (pas de `transform` au survol).
// - Les étiquettes d'état sont des `rounded-hair` en mono, chacune à 4,5:1 au
//   moins sur son fond (les teintes -800 en clair, -300 en sombre).
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

export const field = fieldClass;

// Enregistrer, ajouter, vérifier : encre pleine (le rouge reste à l'action
// principale de l'écran, `btnAccent`).
export const btnPrimary = buttonClass({ variant: "ink" });
export const btnPrimarySm = buttonClass({ variant: "ink", size: "sm" });

// Annuler, autres actions : contour encre.
export const btnGhost = buttonClass({ variant: "secondary" });
export const btnGhostSm = buttonClass({ variant: "secondary", size: "sm" });

// L'action principale de l'écran (connexion, inscription, accepter le devis,
// payer, autoriser) : la buse chaude. Une seule par écran.
export const btnAccent = buttonClass({ variant: "primary" });
export const btnAccentLg = buttonClass({
  variant: "primary",
  size: "lg",
  full: true,
});

// Action destructive (supprimer, refuser) : contour et texte `accent-text`,
// rempli au survol. Écrit à plat plutôt qu'en surchargeant `buttonClass` : deux
// utilitaires de couleur en conflit ne se départagent pas par leur ordre dans
// l'attribut class.
export const btnDanger =
  "inline-flex h-11 select-none items-center justify-center gap-2 whitespace-nowrap rounded-field border border-accent-text px-5 text-[0.9375rem] font-semibold text-accent-text transition-colors duration-150 ease-strate hover:bg-accent-text hover:text-paper disabled:pointer-events-none disabled:opacity-50";

// Lien discret sous un formulaire (« Mot de passe oublié », « Retour »).
export const linkSoft =
  "text-sm font-medium text-soft underline decoration-line decoration-1 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink";

// Lien d'accent dans une phrase (« Pas encore de compte ? S'inscrire »).
export const linkAccent =
  "font-semibold text-accent-text underline decoration-1 underline-offset-4 transition-colors duration-150 hover:decoration-2";

// « ← Retour » en tête d'une page de détail (commande, devis, paiement).
export const backLink =
  "mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors duration-150 hover:text-ink";

// Carte de section : conteneur standard d'un bloc de réglages.
export const card = "rounded-card border border-line bg-surface p-5 sm:p-6";

// Liste de lignes cliquables (commandes, devis) : un seul cadre, des filets
// entre les lignes. `overflow-hidden` arrondit aussi le survol des lignes.
export const rowList =
  "divide-y divide-line overflow-hidden rounded-card border border-line bg-surface";
export const rowLink =
  "flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-paper";
export const rowLinkBlock =
  "block px-5 py-4 transition-colors duration-150 hover:bg-paper";

// Messages d'état : toujours un texte, jamais une couleur seule.
export const alertError =
  "rounded-field bg-accent/10 px-4 py-3 text-sm font-medium text-accent-text";
export const alertSuccess =
  "rounded-field bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200";
export const alertWarn =
  "rounded-field bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200";

// Étiquette d'état (commande, devis, e-mail vérifié, adresse par défaut…).
export const badge =
  "s3d-label inline-flex shrink-0 items-center rounded-hair px-2 py-1";
export const badgeNeutral = "border border-line bg-paper text-soft";
export const badgeSuccess =
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
export const badgeWarn = "bg-amber-500/15 text-amber-800 dark:text-amber-200";

// Palette de statut des commandes et des devis.
export const statusStyle: Record<string, string> = {
  pending: badgeWarn,
  paid: badgeSuccess,
  in_production: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delivered: badgeSuccess,
  cancelled: "bg-accent/10 text-accent-text",
  received: badgeWarn,
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  revision_requested: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  accepted: badgeSuccess,
  declined: "bg-accent/10 text-accent-text",
  done: badgeSuccess,
  rejected: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
};

/** Classes complètes d'une étiquette de statut (repli neutre si inconnu). */
export function statusBadge(status: string): string {
  return `${badge} ${statusStyle[status] ?? badgeNeutral}`;
}
