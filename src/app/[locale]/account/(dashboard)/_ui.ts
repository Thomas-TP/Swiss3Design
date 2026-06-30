// Classes utilitaires partagées par les onglets du compte. Extraites de
// account-security.tsx pour rester cohérentes d'un onglet à l'autre.

export const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-60";

// Carte de section : conteneur standard d'un bloc de réglages.
export const card = "rounded-card border border-line bg-surface p-5 sm:p-6";

// Badge de statut arrondi (réutilise la palette de statut des commandes/devis).
export const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  in_production: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-300",
  received: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  revision_requested: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  declined: "bg-red-500/15 text-red-600 dark:text-red-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-stone-500/15 text-stone-600 dark:text-stone-300",
};
