import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { ObjectCard } from "@/components/studio/object-card";
import { OBJECT_TEXT_FIELDS } from "@/lib/studio/text/fields";
import type { StudioObjectId, StudioTexts } from "@/lib/studio/types";

// Rangée « À personnaliser au Studio » (brief « Strates », §7.8) : les quatre
// objets originaux de l'atelier, personnalisables en 3D puis envoyés pour un
// devis. Ce ne sont PAS des produits de la boutique : aucun prix ferme (« Sur
// devis », une fourchette le jour où le propriétaire valide les coefficients),
// aucun JSON-LD produit, aucune carte d'achat. Chaque carte montre l'objet dans
// ses couleurs (le même aperçu que l'index du Studio) et mène à
// `/studio/<objet>` ; les slugs sont des noms propres, identiques dans les 4
// langues (§1.6).
const OBJECTS: readonly StudioObjectId[] = [
  "lavaux",
  "cartouche",
  "relief",
  "borne",
];

export function StudioRow({ className }: { className?: string }) {
  const t = useTranslations("catalog.shop.studio");
  const core = useTranslations("studioCore");
  const locale = useLocale();

  return (
    <section aria-labelledby="shop-studio-title" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-[46rem]">
          <h2
            id="shop-studio-title"
            className="font-display text-title text-ink"
          >
            {t("title")}
          </h2>
          <p className="mt-3 text-soft">{t("intro")}</p>
        </div>
      </div>
      <ul className="s3d-grid mt-8 gap-y-6">
        {OBJECTS.map((object) => {
          // Les textes d'exemple de la langue : la taille des lignes de l'aperçu.
          const texts: StudioTexts = {};
          for (const field of OBJECT_TEXT_FIELDS[object])
            texts[field] = core(`examples.${field}`);
          return (
            <li
              key={object}
              className="col-span-full sm:col-span-6 lg:col-span-3"
            >
              <ObjectCard
                object={object}
                locale={locale}
                texts={texts}
                name={t(`objects.${object}.name`)}
                tagline={t(`objects.${object}.line`)}
                price={t("quote")}
                cta={t("adjust")}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** « J'ai un fichier » : le chemin d'un clic vers le sur-mesure (§7.8). */
export function FileLine({ className }: { className?: string }) {
  const t = useTranslations("catalog.shop.file");
  return (
    <section aria-labelledby="shop-file-title" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-y border-line py-8">
        <div className="max-w-[46rem]">
          <h2 id="shop-file-title" className="font-display text-title text-ink">
            {t("title")}
          </h2>
          <p className="mt-3 text-soft">{t("text")}</p>
        </div>
        <ButtonLink href="/custom" variant="secondary" size="md">
          {t("cta")}
        </ButtonLink>
      </div>
    </section>
  );
}
