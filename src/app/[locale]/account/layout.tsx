import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

// Tout l'espace compte (connexion, inscription, mot de passe oublié et tableau
// de bord) est hors index : déjà fermé au crawl dans robots.ts, le noindex
// couvre le cas où un robot y arriverait quand même (lien externe, règle
// robots.txt modifiée plus tard).
export const metadata: Metadata = { robots: NOINDEX };

export default function AccountRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
