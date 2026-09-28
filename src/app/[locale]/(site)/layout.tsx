import { SiteShell } from "@/components/site-shell";

// Groupe de routes (site), absent de l'URL : accueil, boutique, fiche produit,
// sur mesure, Atelier, contact (et le Studio à venir). Il n'existe que pour
// que ces pages partagent une SiteShell persistante (Lenis, Stage WebGL) que
// le reste de l'arbre [locale] ne charge jamais (brief de refonte, §4.2).
// Aucun <html> ici : le layout racine reste src/app/[locale]/layout.tsx, avec
// Header, Footer, BottomNav et le script anti-flash.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
