import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { SiteLink } from "@/components/ui/site-link";
import { StrataIcon } from "@/components/ui/icons";

// Rangée « À régler au Studio » (brief « Strates », §7.8) : les quatre objets
// originaux de l'atelier, réglables en 3D puis envoyés pour un devis. Ce ne sont
// PAS des produits de la boutique : aucun prix fixe (« Sur devis », une
// fourchette le jour où le propriétaire valide les coefficients), aucun JSON-LD
// produit, aucune carte d'achat. Chaque carte mène à `/studio/<objet>` ; les
// slugs sont des noms propres, identiques dans les 4 langues (§1.6).
const OBJECTS = ["lavaux", "cartouche", "relief", "borne"] as const;

export function StudioRow({ className }: { className?: string }) {
  const t = useTranslations("catalog.shop.studio");

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
      <ul className="s3d-grid mt-8 gap-y-4">
        {OBJECTS.map((object) => (
          <li
            key={object}
            className="col-span-full sm:col-span-4 lg:col-span-3"
          >
            <div className="relative flex h-full flex-col rounded-card border border-line bg-surface p-5">
              <StrataIcon size={22} className="text-iso-index" />
              <h3 className="mt-4 font-display text-[1.0625rem] font-bold leading-snug tracking-tight text-ink">
                <SiteLink
                  href={`/studio/${object}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
                >
                  {t(`objects.${object}.name`)}
                </SiteLink>
              </h3>
              <p className="mt-2 flex-1 text-sm text-soft">
                {t(`objects.${object}.line`)}
              </p>
              <p className="s3d-label mt-4 flex items-center justify-between normal-case text-ink">
                <span>{t("quote")}</span>
                <span className="text-soft">{t("adjust")} →</span>
              </p>
            </div>
          </li>
        ))}
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
