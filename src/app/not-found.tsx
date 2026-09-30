import { getLocale } from "next-intl/server";
import { LocaleShell } from "@/components/locale-shell";
import {
  NotFoundContent,
  notFoundMetadata,
} from "@/components/not-found-content";

// 404 des URL sans route (/fr/zzz-inconnu, /fr/shop/zzz…). Next la sert par sa
// route interne /_not-found : layout racine + ce fichier, sans les layouts des
// segments dynamiques, d'où l'habillage (LocaleShell) rappelé ici. Rendue
// entièrement côté serveur, avec le statut 404 et <meta name="robots"
// content="noindex"> posés par Next. Remplace l'ancien [...rest]/page.tsx qui
// lançait notFound() : ce rendu-là retombait sur un corps vide (voir
// src/app/layout.tsx).
export const generateMetadata = notFoundMetadata;

export default async function RootNotFound() {
  const locale = await getLocale();
  return (
    <LocaleShell locale={locale}>
      <NotFoundContent />
    </LocaleShell>
  );
}
