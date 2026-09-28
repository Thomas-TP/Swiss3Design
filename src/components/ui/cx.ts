// Concatène des classes en ignorant les valeurs vides. Pas de clsx ni de
// tailwind-merge dans le dépôt : les primitives du chrome n'en ont pas besoin
// (aucune fusion de conflits, l'appelant ajoute, il ne remplace pas), et une
// dépendance de plus partirait dans le JS de chaque page.
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
