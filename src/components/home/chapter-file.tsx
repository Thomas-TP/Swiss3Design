import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Chapter } from "@/components/ui/chapter";

// Chapitre 06 « Vous avez déjà un fichier ? » (brief « Strates », §7.5) : la
// troisième entrée de l'accueil, celle de qui vient avec son modèle. Aucun
// mouvement. Son bouton rouge est celui de ce dernier écran (un seul rouge à la
// fois : ceux du héros et du chapitre 02 sont loin au-dessus).
export function ChapterFile() {
  const t = useTranslations("landing.file");
  const tr = useTranslations("landing.rail");
  return (
    <Chapter
      id="fichier"
      number="06"
      title={t("title")}
      eyebrow={tr("file")}
      intro={t("text")}
    >
      <div className="s3d-page mt-10">
        <ButtonLink href="/custom" variant="primary" size="lg">
          {t("cta")}
        </ButtonLink>
      </div>
    </Chapter>
  );
}
