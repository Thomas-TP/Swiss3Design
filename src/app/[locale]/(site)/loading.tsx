import { getTranslations } from "next-intl/server";
import { PageCut } from "@/components/ui/page-cut";

// Écran de chargement des pages vitrine (25.10.2026). Les pages du groupe
// (site) sont dynamiques (`force-dynamic`) : sans ce fichier, un clic attendait
// tout le rendu du Worker (0,2 à 1,8 s mesurés) sur l'ancienne page figée.
// Avec lui, Next affiche ce squelette dès le clic (préchargé par les liens du
// chrome, voir SiteLink), puis la page arrive à sa place en streaming. Il est
// enveloppé de <PageCut> : la transition de page joue sur lui, sans attendre
// le serveur. Composant serveur, aucun JS.
export default async function SiteLoading() {
  const t = await getTranslations("shell");
  return (
    <PageCut>
      <div
        aria-busy="true"
        className="mx-auto min-h-[70dvh] w-full max-w-[90rem] px-5 pb-24 pt-10 sm:px-8 sm:pt-16"
      >
        <output className="sr-only">{t("pending")}</output>
        <div aria-hidden="true" className="s3d-skeleton space-y-5">
          <div className="h-3 w-40 rounded-hair" />
          <div className="h-14 w-3/4 max-w-xl rounded-field sm:h-20" />
          <div className="h-4 w-full max-w-md rounded-hair" />
          <div className="grid grid-cols-2 gap-4 pt-8 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </PageCut>
  );
}
