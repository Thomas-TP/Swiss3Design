import type { Metadata } from "next";
import { ClientMessages } from "@/i18n/client-messages";
import { NOINDEX } from "@/lib/seo";

// Tout l'espace compte (connexion, inscription, mot de passe oublié et tableau
// de bord) est hors index : déjà fermé au crawl dans robots.ts, le noindex
// couvre le cas où un robot y arriverait quand même (lien externe, règle
// robots.txt modifiée plus tard).
export const metadata: Metadata = { robots: NOINDEX };

// Messages client communs à tout l'espace compte : `auth` sert aux formulaires
// de connexion, d'inscription et de mot de passe, aux boutons de connexion
// sociale et au bouton de déconnexion du tableau de bord.
export default function AccountRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientMessages namespaces={["auth"]}>{children}</ClientMessages>;
}
