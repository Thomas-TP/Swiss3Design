// Redirections permanentes des anciennes adresses du Studio. Le sous-verre
// « Relief » (`/studio/relief`) est devenu la « Montagne » (`/studio/montagne`,
// 10.10.2026) : les liens de l'aperçu de la refonte, les favoris et les moteurs
// continuent d'arriver au bon endroit. `next.config.ts` les sert en 308 avant
// toute page ; Next transmet la requête telle quelle (`?s=100&h=60…`) et le
// navigateur garde le fragment (`#c=…`), qu'aucun serveur ne voit. Une ancienne
// configuration de sous-verre (clés `ba`, `re`, `lk`…) n'a pas de sens pour la
// montagne : la page tombe sur ses réglages par défaut avec le mot « lien
// illisible », comme pour tout lien invalide.
//
// Module pur et sans alias : `next.config.ts` l'importe par chemin relatif.
export const LEGACY_STUDIO_REDIRECTS = [
  {
    source: "/:locale(fr|de|it|en)/studio/relief",
    destination: "/:locale/studio/montagne",
    permanent: true,
  },
  {
    // Sans langue : le proxy next-intl choisit la langue sur la NOUVELLE adresse.
    source: "/studio/relief",
    destination: "/studio/montagne",
    permanent: true,
  },
] as const;
