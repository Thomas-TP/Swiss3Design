import { SiteShell } from "@/components/site-shell";
import { ClientMessages } from "@/i18n/client-messages";

// Groupe de routes (site), absent de l'URL : accueil, boutique, fiche produit,
// sur mesure, Atelier, contact (et le Studio à venir). Il n'existe que pour
// que ces pages partagent une SiteShell persistante (Lenis, Stage WebGL) que
// le reste de l'arbre [locale] ne charge jamais (brief de refonte, §4.2).
// Aucun <html> ici : le document (et le script anti-flash) est dans le layout
// racine src/app/layout.tsx, l'habillage (Header, Footer, BottomNav) dans
// src/components/locale-shell.tsx, posé par src/app/[locale]/layout.tsx.
//
// Messages du groupe : la carte produit est son atome commun (accueil, boutique,
// fiche, favoris) et ses composants client lisent `product` (bouton d'ajout)
// et `favorites` (cœur). Le reste vient du layout de chaque page.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["product", "favorites"]}>
      <SiteShell>{children}</SiteShell>
    </ClientMessages>
  );
}
